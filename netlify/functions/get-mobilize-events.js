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
    console.log('🔍 Fetching Field Team 6 voter registration events...');
    
    const mobilizeUrl = 'https://api.mobilize.us/v1/events?organization=ft6&timeslot_start=gte_now&per_page=100';
    
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
    let voterRegEventCount = 0;
    
    if (data.data && Array.isArray(data.data)) {
      data.data.forEach((event, index) => {
        // Check for voter registration related tags
        const hasVoterRegTag = event.tags && event.tags.some(tag => {
          if (!tag.name) return false;
          const tagName = tag.name.toLowerCase();
          return tagName === 'voter registration' || 
                 tagName === 'voter registration training' ||
                 tagName === 'voter registration week' ||
                 tagName.includes('voter registration');
        });
        
        if (!hasVoterRegTag) {
          return; // Skip non-voter registration events
        }
        
        voterRegEventCount++;
        console.log(`🗳️ Found Voter Registration event #${voterRegEventCount}: ${event.title || 'Untitled'}`);
        
        // Log the specific event we're looking for
        if (event.id === 815530) {
          console.log(`🎯 FOUND TARGET EVENT 815530!`);
          console.log(`   Title: ${event.title}`);
          console.log(`   Location: ${event.location ? `${event.location.locality}, ${event.location.region}` : 'No location'}`);
          console.log(`   Tags: ${event.tags ? event.tags.map(tag => tag.name).join(', ') : 'No tags'}`);
        }
        
        if (!event.location || !event.timeslots || event.timeslots.length === 0) {
          console.log(`⚠️ Skipping voter reg event: Missing location or timeslots`);
          return;
        }

        const location = event.location;
        const firstTimeslot = event.timeslots[0];
        
        console.log(`📍 Voter reg event location: ${location.locality}, ${location.region}`);
        
        const district = getDistrictFromState(location.region);
        
        const processedEvent = {
          id: event.id,
          title: event.title || 'Field Team 6 Voter Registration',
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
          
          if (event.id === 815530) {
            console.log(`✅ TARGET EVENT 815530 SUCCESSFULLY ADDED!`);
          }
          
          console.log(`✅ Added voter reg event: ${processedEvent.title} in ${processedEvent.district}`);
        } else {
          if (event.id === 815530) {
            console.log(`❌ TARGET EVENT 815530 REJECTED: Missing date or location`);
          }
        }
      });
    }

    console.log(`📊 Found ${voterRegEventCount} total voter registration events`);
    console.log(`📊 Processed ${processedEvents.length} valid voter registration events`);
    
    // Log California events specifically
    const caEvents = processedEvents.filter(e => 
      e.state && (e.state.toUpperCase() === 'CA' || e.state.toUpperCase() === 'CALIFORNIA')
    );
    console.log(`🌴 California voter registration events: ${caEvents.length}`);
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
          voterRegistrationEvents: voterRegEventCount,
          validProcessed: processedEvents.length,
          californiaEvents: caEvents.length
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
