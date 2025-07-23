// netlify/functions/get-mobilize-events.js
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
    console.log('🔍 Fetching Field Team 6 events from Mobilize...');
    
    const mobilizeUrl = 'https://api.mobilize.us/v1/organizations/ft6/events?timeslot_start=gte_now&per_page=100';
    
    const response = await fetch(mobilizeUrl, {
      headers: {
        'User-Agent': 'Drive-Scout-App/1.0',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Mobilize API responded with status: ${response.status}`);
    }

    const data = await response.json();
    console.log(`📊 Raw events from API: ${data.data ? data.data.length : 0}`);
    
    const processedEvents = [];
    let totalEvents = 0;
    let driveEvents = 0;
    let californiaEvents = 0;
    let validEvents = 0;
    
    if (data.data && Array.isArray(data.data)) {
      data.data.forEach((event, index) => {
        totalEvents++;
        
        // Log details for event 815530 specifically
        if (event.id === 815530) {
          console.log(`🎯 FOUND TARGET EVENT 815530!`);
          console.log(`   Title: ${event.title}`);
          console.log(`   Location: ${event.location ? `${event.location.locality}, ${event.location.region}` : 'No location'}`);
          console.log(`   Tags: ${event.tags ? event.tags.map(tag => tag.name).join(', ') : 'No tags'}`);
          console.log(`   Timeslots: ${event.timeslots ? event.timeslots.length : 0}`);
        }
        
        // Check if event has "Drive" tag
        const hasDriveTag = event.tags && event.tags.some(tag => 
          tag.name && tag.name.toLowerCase() === 'drive'
        );
        
        if (hasDriveTag) {
          driveEvents++;
          console.log(`🚗 Drive event #${driveEvents}: ${event.title || 'Untitled'}`);
          
          // Check if it's in California
          if (event.location && event.location.region && 
              (event.location.region.toUpperCase() === 'CA' || event.location.region.toUpperCase() === 'CALIFORNIA')) {
            californiaEvents++;
            console.log(`🌴 California drive: ${event.title} in ${event.location.locality}`);
          }
        }
        
        if (!hasDriveTag) {
          // Log a few non-drive events to see what tags they have
          if (index < 5) {
            console.log(`⚪ Non-drive event: ${event.title} - Tags: ${event.tags ? event.tags.map(tag => tag.name).join(', ') : 'No tags'}`);
          }
          return;
        }
        
        if (!event.location || !event.timeslots || event.timeslots.length === 0) {
          console.log(`⚠️ Skipping drive: Missing location or timeslots`);
          return;
        }

        const location = event.location;
        const firstTimeslot = event.timeslots[0];
        
        const district = getDistrictFromState(location.region);
        
        const processedEvent = {
          id: event.id,
          title: event.title || 'Field Team 6 Voter Drive',
          description: event.description || '',
          location: location.venue || location.address_lines?.[0] || 'Location TBD',
          city: location.locality,
          state: location.region,
          zipCode: location.postal_code,
          district: district,
          date: firstTimeslot.start_date ? firstTimeslot.start_date.toString().split('T')[0] : null,
          startTime: firstTimeslot.start_date ? formatTime(firstTimeslot.start_date) : null,
          endTime: firstTimeslot.end_date ? formatTime(firstTimeslot.end_date) : null,
          coordinates: location.latitude && location.longitude ? 
            [parseFloat(location.latitude), parseFloat(location.longitude)] : null,
          mobilizeUrl: `https://www.mobilize.us/ft6/event/${event.id}/`,
          isVirtual: location.venue && location.venue.toLowerCase().includes('virtual'),
          tags: event.tags ? event.tags.map(tag => tag.name) : []
        };

        if (processedEvent.date && (processedEvent.coordinates || processedEvent.city)) {
          processedEvents.push(processedEvent);
          validEvents++;
          
          if (event.id === 815530) {
            console.log(`✅ TARGET EVENT 815530 SUCCESSFULLY ADDED!`);
            console.log(`   Final data: ${JSON.stringify(processedEvent, null, 2)}`);
          }
        } else {
          if (event.id === 815530) {
            console.log(`❌ TARGET EVENT 815530 REJECTED!`);
            console.log(`   Date: ${processedEvent.date}`);
            console.log(`   Coordinates: ${processedEvent.coordinates}`);
            console.log(`   City: ${processedEvent.city}`);
          }
        }
      });
    }

    console.log(`\n📊 === PROCESSING SUMMARY ===`);
    console.log(`📊 Total events from API: ${totalEvents}`);
    console.log(`🚗 Events with 'Drive' tag: ${driveEvents}`);
    console.log(`🌴 California drive events: ${californiaEvents}`);
    console.log(`✅ Valid processed events: ${validEvents}`);
    
    // Log all California events for debugging
    const caEvents = processedEvents.filter(e => e.state && (e.state.toUpperCase() === 'CA' || e.state.toUpperCase() === 'CALIFORNIA'));
    console.log(`\n🌴 California events being returned:`);
    caEvents.forEach(event => {
      console.log(`  - ${event.title} in ${event.city} (${event.coordinates})`);
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        count: processedEvents.length,
        events: processedEvents,
        lastUpdated: new Date().toISOString(),
        debugStats: {
          totalEvents,
          driveEvents,
          californiaEvents,
          validEvents
        }
      })
    };

  } catch (error) {
    console.error('❌ Error fetching Mobilize events:', error.message);
    
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

function getDistrictFromState(region) {
  if (!region) return 'Unknown';
  
  const state = region.toUpperCase().trim();
  
  switch (state) {
    case 'AK': case 'ALASKA': return 'AK-AL';
    case 'AZ': case 'ARIZONA': return 'AZ-??';
    case 'CA': case 'CALIFORNIA': return 'CA-??';
    case 'CO': case 'COLORADO': return 'CO-??';
    case 'CT': case 'CONNECTICUT': return 'CT-??';
    case 'FL': case 'FLORIDA': return 'FL-??';
    case 'NV': case 'NEVADA': return 'NV-??';
    default: return `${state}-??`;
  }
}

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
