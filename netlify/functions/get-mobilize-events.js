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
        
        // Only include events with "drive" tag (actual voter registration drives)
        const hasDriveTag = event.tags && event.tags.some(tag => {
          if (!tag.name) return false;
          return tag.name.toLowerCase() === 'drive';
        });
        
        if (!hasDriveTag) {
          return; // Skip events without drive tag
        }
        
        voterDriveCount++;
        console.log(`🚗 Voter Drive #${voterDriveCount}: ${event.title} (ID: ${event.id})`);
        console.log(`   Tags: ${event.tags ? event.tags.map(tag => tag.name).join(', ') : 'No tags'}`);
        
        // Check specifically for event 815530
        if (event.id === 815530) {
          console.log(`🎯 FOUND TARGET EVENT 815530!`);
          console.log(`   Title: ${event.title}`);
          console.log(`   Location: ${event.location ? `${event.location.locality}, ${event.location.region}` : 'No location'}`);
        }

        if (!event.location || !event.timeslots || event.timeslots.length === 0) {
          console.log(`⚠️ Skipping voter drive: Missing location or timeslots`);
          return;
        }

        const location = event.location;
        const firstTimeslot = event.timeslots[0];
        
        console.log(`📍 Voter drive location: ${location.locality}, ${location.region}`);
        
        // Check for district-specific tag (case-insensitive)
        const hasCA45Tag = event.tags && event.tags.some(tag => {
          if (!tag.name) return false;
          return tag.name.toLowerCase() === 'ca45';
        });
        
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
          tags: event.tags ? event.tags.map(tag => tag.name) : [],
          hasCA45Tag: hasCA45Tag,
          matchType: hasCA45Tag ? 'exact' : 'pending' // Will update with distance check
        };

        processedEvents.push(processedEvent);
        
        if (event.id === 815530) {
          console.log(`✅ TARGET EVENT 815530 SUCCESSFULLY ADDED!`);
        }
      });
    }

    console.log(`📊 Found ${voterDriveCount} total voter drives with 'drive' tag`);
    console.log(`📊 Processed ${processedEvents.length} valid voter drives`);
    
    // Now filter for CA-45 relevance
    const ca45Center = [33.6846, -117.8265]; // Irvine area, center of CA-45
    const ca45RelevantEvents = [];
    
    processedEvents.forEach(event => {
      // Check if event has CA45 tag
      if (event.hasCA45Tag) {
        event.matchType = 'exact';
        event.distance = 0;
        ca45RelevantEvents.push(event);
        console.log(`🎯 CA-45 tagged event: ${event.title} in ${event.city}`);
      }
      // Check if event is within 50 miles of CA-45 center
      else if (event.coordinates) {
        const distance = calculateDistance(
          ca45Center[0], ca45Center[1],
          event.coordinates[0], event.coordinates[1]
        );
        
        if (distance <= 50) {
          event.matchType = 'nearby';
          event.distance = Math.round(distance);
          ca45RelevantEvents.push(event);
          console.log(`📍 Nearby event: ${event.title} in ${event.city} (${Math.round(distance)} miles from CA-45)`);
        } else {
          console.log(`❌ Too far: ${event.title} in ${event.city} (${Math.round(distance)} miles from CA-45)`);
        }
      } else {
        console.log(`⚠️ No coordinates: ${event.title} in ${event.city} - cannot calculate distance`);
      }
    });
    
    // Sort CA-45 relevant events: exact matches first, then by distance
    ca45RelevantEvents.sort((a, b) => {
      if (a.matchType === 'exact' && b.matchType !== 'exact') return -1;
      if (b.matchType === 'exact' && a.matchType !== 'exact') return 1;
      return (a.distance || 0) - (b.distance || 0);
    });
    
    console.log(`🌟 CA-45 relevant events: ${ca45RelevantEvents.length}`);
    ca45RelevantEvents.forEach(event => {
      const distanceText = event.matchType === 'exact' ? 'IN DISTRICT' : `${event.distance} miles`;
      console.log(`  - ${event.title} in ${event.city} (${distanceText})`);
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        count: ca45RelevantEvents.length,
        events: ca45RelevantEvents,
        lastUpdated: new Date().toISOString(),
        debugInfo: {
          totalApiEvents: data.data ? data.data.length : 0,
          voterDriveEvents: voterDriveCount,
          validProcessed: processedEvents.length,
          ca45RelevantEvents: ca45RelevantEvents.length,
          foundTargetEvent815530: ca45RelevantEvents.some(e => e.id === 815530)
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

function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

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
