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
    console.log('🔍 Fetching Field Team 6 events using correct Organization ID 1255...');
    
    // Use the correct organization ID from Mobilize account settings
    const mobilizeUrl = 'https://api.mobilize.us/v1/organizations/1255/events?timeslot_start=gte_now&per_page=100';
    
    console.log('📡 Using correct API URL:', mobilizeUrl);
    
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
    console.log(`📊 Raw events from correct API: ${data.data ? data.data.length : 0}`);
    
    const processedEvents = [];
    let voterDriveCount = 0;
    
    if (data.data && Array.isArray(data.data)) {
      data.data.forEach((event, index) => {
        console.log(`🔍 Event ${index + 1}: ${event.title || 'Untitled'} (ID: ${event.id})`);
        
        // Check specifically for event 815530
        if (event.id === 815530) {
          console.log(`🎯 FOUND TARGET EVENT 815530!`);
          console.log(`   Title: ${event.title}`);
          console.log(`   Location: ${event.location ? `${event.location.locality}, ${event.location.region}` : 'No location'}`);
          console.log(`   Tags: ${event.tags ? event.tags.map(tag => tag.name).join(', ') : 'No tags'}`);
        }
        
        // Look for voter registration related events (be very inclusive)
        const hasVoterTag = event.tags && event.tags.some(tag => {
          if (!tag.name) return false;
          const tagName = tag.name.toLowerCase();
          return tagName.includes('voter') || 
                 tagName.includes('registration') ||
                 tagName.includes('drive') ||
                 tagName.includes('canvass') ||
                 tagName.includes('gotv') ||
                 tagName.includes('get out the vote');
        });
        
        // Also include events with "voter registration" in title or description
        const hasVoterContent = (event.title && event.title.toLowerCase().includes('voter')) ||
                               (event.description && event.description.toLowerCase().includes('voter')) ||
                               (event.event_type && event.event_type.toLowerCase().includes('voter'));
        
        if (hasVoterTag || hasVoterContent || event.id === 815530) {
          voterDriveCount++;
          console.log(`🗳️ Voter-related event #${voterDriveCount}: ${event.title} (ID: ${event.id})`);
          
          if (!event.location || !event.timeslots || event.timeslots.length === 0) {
            console.log(`⚠️ Skipping voter event: Missing location or timeslots`);
            return;
          }

          const location = event.location;
          const firstTimeslot = event.timeslots[0];
          
          console.log(`📍 Voter event location: ${location.locality}, ${location.region}`);
          
          const district = getDistrictFromState(location.region);
          
          const processedEvent = {
            id: event.id,
            title: event.title || 'Field Team 6 Event',
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

          processedEvents.push(processedEvent);
          
          if (event.id === 815530) {
            console.log(`✅ TARGET EVENT 815530 SUCCESSFULLY ADDED!`);
          }
        }
      });
    }

    console.log(`📊 Found ${voterDriveCount} total voter-related events`);
    console.log(`📊 Processed ${processedEvents.length} valid events`);
    
    // Log California events specifically
    const caEvents = processedEvents.filter(e => 
      e.state && (e.state.toUpperCase() === 'CA' || e.state.toUpperCase() === 'CALIFORNIA')
    );
    console.log(`🌴 California voter events: ${caEvents.length}`);
    caEvents.forEach(event => {
      console.log(`  - ${event.title} in ${event.city} (ID: ${event.id})`);
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        count: processedEvents.length,
        events: processedEvents,
        lastUpdated: new Date().toISOString(),
        debugInfo: {
          totalApiEvents: data.data ? data.data.length : 0,
          voterRelatedEvents: voterDriveCount,
          validProcessed: processedEvents.length,
          californiaEvents: caEvents.length,
          foundTargetEvent815530: processedEvents.some(e => e.id === 815530)
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
