exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    console.log('🔍 Aggressively searching for event 815530...');
    
    let foundTarget = false;
    let allEvents = [];
    let totalChecked = 0;
    
    // Try multiple pages and date ranges
    const searchConfigs = [
      { url: 'https://api.mobilize.us/v1/events?organization=ft6&per_page=200&page=1', desc: 'Page 1, no date filter' },
      { url: 'https://api.mobilize.us/v1/events?organization=ft6&per_page=200&page=2', desc: 'Page 2, no date filter' },
      { url: 'https://api.mobilize.us/v1/events?organization=ft6&per_page=200&page=3', desc: 'Page 3, no date filter' },
      { url: 'https://api.mobilize.us/v1/events?organization=ft6&timeslot_start=gte_2025-07-01&per_page=200', desc: 'Since July 2025' },
      { url: 'https://api.mobilize.us/v1/events?organization=ft6&timeslot_start=gte_2025-06-01&per_page=200', desc: 'Since June 2025' },
      { url: 'https://api.mobilize.us/v1/events?organization=ft6&timeslot_start=gte_now&per_page=200', desc: 'Future events only' }
    ];
    
    for (const config of searchConfigs) {
      try {
        console.log(`🔍 Searching: ${config.desc}`);
        
        const response = await fetch(config.url, {
          headers: {
            'User-Agent': 'Drive-Scout-App/1.0',
            'Accept': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          const eventCount = data.data ? data.data.length : 0;
          totalChecked += eventCount;
          
          console.log(`📊 ${config.desc}: ${eventCount} events`);
          
          if (data.data && Array.isArray(data.data)) {
            // Look for our target event
            const targetEvent = data.data.find(e => e.id === 815530);
            if (targetEvent && !foundTarget) {
              foundTarget = true;
              console.log(`🎯 FOUND EVENT 815530 in ${config.desc}!`);
              console.log(`   Title: ${targetEvent.title}`);
              console.log(`   Tags: ${targetEvent.tags ? targetEvent.tags.map(tag => tag.name).join(', ') : 'No tags'}`);
              console.log(`   Location: ${targetEvent.location ? `${targetEvent.location.locality}, ${targetEvent.location.region}` : 'No location'}`);
              console.log(`   Date: ${targetEvent.timeslots ? targetEvent.timeslots[0]?.start_date : 'No timeslots'}`);
              
              // Add this event to our results
              if (targetEvent.location && targetEvent.timeslots && targetEvent.timeslots.length > 0) {
                const location = targetEvent.location;
                const firstTimeslot = targetEvent.timeslots[0];
                
                allEvents.push({
                  id: targetEvent.id,
                  title: targetEvent.title || 'Field Team 6 Event',
                  description: targetEvent.description || '',
                  location: location.venue || location.address_lines?.[0] || 'Location TBD',
                  city: location.locality,
                  state: location.region,
                  zipCode: location.postal_code,
                  district: 'CA-??',
                  date: firstTimeslot.start_date ? firstTimeslot.start_date.toString().split('T')[0] : null,
                  startTime: firstTimeslot.start_date ? formatTime(firstTimeslot.start_date) : null,
                  endTime: firstTimeslot.end_date ? formatTime(firstTimeslot.end_date) : null,
                  coordinates: location.latitude && location.longitude ? 
                    [parseFloat(location.latitude), parseFloat(location.longitude)] : null,
                  mobilizeUrl: `https://www.mobilize.us/ft6/event/${targetEvent.id}/`,
                  isVirtual: location.venue && location.venue.toLowerCase().includes('virtual'),
                  tags: targetEvent.tags ? targetEvent.tags.map(tag => tag.name) : [],
                  searchSource: config.desc
                });
              }
            }
            
            // Also check for any California events in this batch
            const caEventsInBatch = data.data.filter(e => 
              e.location && e.location.region && 
              (e.location.region.toUpperCase() === 'CA' || e.location.region.toUpperCase() === 'CALIFORNIA')
            );
            
            if (caEventsInBatch.length > 0) {
              console.log(`🌴 Found ${caEventsInBatch.length} CA events in ${config.desc}:`);
              caEventsInBatch.forEach(caEvent => {
                console.log(`  - ${caEvent.title} (ID: ${caEvent.id}) in ${caEvent.location.locality}`);
                console.log(`    Tags: ${caEvent.tags ? caEvent.tags.map(tag => tag.name).join(', ') : 'No tags'}`);
                
                // Add CA events to our results if not already added
                if (!allEvents.find(existing => existing.id === caEvent.id) && 
                    caEvent.timeslots && caEvent.timeslots.length > 0) {
                  const location = caEvent.location;
                  const firstTimeslot = caEvent.timeslots[0];
                  
                  allEvents.push({
                    id: caEvent.id,
                    title: caEvent.title || 'Field Team 6 Event',
                    description: caEvent.description || '',
                    location: location.venue || location.address_lines?.[0] || 'Location TBD',
                    city: location.locality,
                    state: location.region,
                    zipCode: location.postal_code,
                    district: 'CA-??',
                    date: firstTimeslot.start_date ? firstTimeslot.start_date.toString().split('T')[0] : null,
                    startTime: firstTimeslot.start_date ? formatTime(firstTimeslot.start_date) : null,
                    endTime: firstTimeslot.end_date ? formatTime(firstTimeslot.end_date) : null,
                    coordinates: location.latitude && location.longitude ? 
                      [parseFloat(location.latitude), parseFloat(location.longitude)] : null,
                    mobilizeUrl: `https://www.mobilize.us/ft6/event/${caEvent.id}/`,
                    isVirtual: location.venue && location.venue.toLowerCase().includes('virtual'),
                    tags: caEvent.tags ? caEvent.tags.map(tag => tag.name) : [],
                    searchSource: config.desc
                  });
                }
              });
            }
          }
        }
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.log(`❌ Error with ${config.desc}: ${error.message}`);
      }
    }

    console.log(`📊 Total events checked across all searches: ${totalChecked}`);
    console.log(`🎯 Event 815530 found: ${foundTarget}`);
    console.log(`🌴 Total California events found: ${allEvents.length}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        count: allEvents.length,
        events: allEvents,
        lastUpdated: new Date().toISOString(),
        searchResults: {
          totalEventsChecked: totalChecked,
          foundTargetEvent815530: foundTarget,
          californiaEventsFound: allEvents.length,
          searchNote: foundTarget ? 'Found target event!' : 'Target event not in API results'
        }
      })
    };

  } catch (error) {
    console.error('❌ Error in aggressive search:', error.message);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message,
        events: []
      })
    };
  }
};

function formatTime(dateString) {
  try {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  } catch (error) {
    return 'Time TBD';
  }
}
