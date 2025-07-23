// netlify/functions/get-mobilize-events.js
exports.handler = async (event, context) => {
  // Enable CORS for your domain
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    console.log('🔍 Fetching Field Team 6 events from Mobilize...');
    
    // Mobilize.us API endpoint for Field Team 6 events
    // Using the organization slug 'ft6' and filtering by tag_ids=20036 (voter registration tag)
    const mobilizeUrl = 'https://api.mobilize.us/v1/organizations/ft6/events?tag_ids=20036&timeslot_start=gte_now&per_page=50';
    
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
    console.log('✅ Successfully fetched Mobilize data');
    
    // Process and filter the events
    const processedEvents = [];
    
    if (data.data && Array.isArray(data.data)) {
      data.data.forEach(event => {
        // Skip events without location data
        if (!event.location || !event.location.locality || !event.timeslots || event.timeslots.length === 0) {
          return;
        }

        // Extract event details
        const location = event.location;
        const firstTimeslot = event.timeslots[0];
        
        // Try to determine congressional district from location
        const district = determineDistrictFromLocation(location);
        
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
          tags: event.tags || []
        };

        // Only include events with valid dates and locations
        if (processedEvent.date && (processedEvent.coordinates || processedEvent.city)) {
          processedEvents.push(processedEvent);
        }
      });
    }

    console.log(`📊 Processed ${processedEvents.length} valid events`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        count: processedEvents.length,
        events: processedEvents,
        lastUpdated: new Date().toISOString()
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

function determineDistrictFromLocation(location) {
  if (!location.locality || !location.region) {
    return 'Unknown';
  }

  const city = location.locality.toLowerCase();
  const state = location.region.toUpperCase();
  
  // Map cities to likely congressional districts based on our swing district data
  const cityToDistrict = {
    // Arizona
    'scottsdale': 'AZ-01',
    'tempe': 'AZ-01',
    'mesa': 'AZ-01',
    'paradise valley': 'AZ-01',
    'fountain hills': 'AZ-01',
    'flagstaff': 'AZ-02',
    'prescott': 'AZ-02',
    'sedona': 'AZ-02',
    'phoenix': 'AZ-04', // Southern Phoenix
    'chandler': 'AZ-04',
    'tucson': 'AZ-06',
    'sierra vista': 'AZ-06',
    
    // California  
    'stockton': 'CA-09',
    'lodi': 'CA-09',
    'tracy': 'CA-09',
    'modesto': 'CA-13',
    'turlock': 'CA-13',
    'merced': 'CA-13',
    'fresno': 'CA-21',
    'hanford': 'CA-21',
    'bakersfield': 'CA-22',
    'santa clarita': 'CA-27',
    'palmdale': 'CA-27',
    'lancaster': 'CA-27',
    'riverside': 'CA-41',
    'corona': 'CA-41',
    'irvine': 'CA-45',
    'tustin': 'CA-45',
    'huntington beach': 'CA-47',
    'garden grove': 'CA-47',
    'oceanside': 'CA-49',
    'carlsbad': 'CA-49',
    
    // Colorado
    'grand junction': 'CO-03',
    'pueblo': 'CO-03',
    'thornton': 'CO-08',
    'westminster': 'CO-08',
    
    // Connecticut
    'waterbury': 'CT-05',
    'danbury': 'CT-05',
    
    // Florida
    'boca raton': 'FL-23',
    'delray beach': 'FL-23',
    'hialeah': 'FL-25',
    'homestead': 'FL-25',
    
    // Nevada
    'las vegas': 'NV-01',
    'henderson': 'NV-03',
    'north las vegas': 'NV-04'
  };

  const districtKey = city + (state ? '-' + state : '');
  return cityToDistrict[city] || `${state}-??`;
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
