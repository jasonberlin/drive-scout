exports.handler = async (event, context) => {
  // Simple CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    console.log('Starting function...');
    
    // Test if basic fetch works first
    const mobilizeUrl = 'https://api.mobilize.us/v1/organizations/ft6/events?timeslot_start=gte_now&per_page=20';
    
    console.log('Making request to:', mobilizeUrl);
    
    const response = await fetch(mobilizeUrl);
    
    console.log('Response status:', response.status);
    
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();
    console.log('Got data, events count:', data.data ? data.data.length : 0);
    
    // Very simple processing - just return first few events as-is for testing
    const events = [];
    
    if (data.data && Array.isArray(data.data)) {
      // Take first 5 events and process minimally
      data.data.slice(0, 5).forEach(event => {
        if (event.location && event.timeslots && event.timeslots.length > 0) {
          events.push({
            id: event.id,
            title: event.title || 'Event',
            city: event.location.locality || 'Unknown',
            state: event.location.region || 'Unknown',
            district: 'TEST-??',
            date: event.timeslots[0].start_date ? event.timeslots[0].start_date.split('T')[0] : null,
            coordinates: event.location.latitude && event.location.longitude ? 
              [parseFloat(event.location.latitude), parseFloat(event.location.longitude)] : null,
            mobilizeUrl: `https://www.mobilize.us/ft6/event/${event.id}/`,
            tags: event.tags ? event.tags.map(tag => tag.name || 'unnamed') : []
          });
        }
      });
    }

    console.log('Processed events:', events.length);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        count: events.length,
        events: events,
        lastUpdated: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('Function error:', error);
    
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
