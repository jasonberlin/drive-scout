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
    console.log('Testing different API endpoints...');
    
    // Test different possible endpoints
    const endpointsToTry = [
      'https://api.mobilize.us/v1/organizations/ft6/events',
      'https://api.mobilize.us/v1/organizations/fieldteam6/events', 
      'https://api.mobilize.us/v1/organizations/field-team-6/events',
      'https://api.mobilize.us/v1/events?organization_id=ft6',
      'https://api.mobilize.us/v1/events?organization=ft6'
    ];
    
    const results = [];
    
    for (const url of endpointsToTry) {
      try {
        console.log(`Testing: ${url}`);
        
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Drive-Scout-App/1.0',
            'Accept': 'application/json'
          }
        });
        
        console.log(`${url} - Status: ${response.status}`);
        
        if (response.ok) {
          const data = await response.json();
          results.push({
            url: url,
            status: response.status,
            success: true,
            eventCount: data.data ? data.data.length : 0,
            sampleData: data.data && data.data.length > 0 ? {
              id: data.data[0].id,
              title: data.data[0].title,
              organization: data.data[0].organization || 'unknown'
            } : null
          });
          
          // If we found a working endpoint, break and use it
          if (data.data && data.data.length > 0) {
            console.log(`SUCCESS! Found working endpoint: ${url}`);
            break;
          }
        } else {
          results.push({
            url: url,
            status: response.status,
            success: false,
            error: `HTTP ${response.status}`
          });
        }
      } catch (error) {
        console.log(`${url} - Error: ${error.message}`);
        results.push({
          url: url,
          success: false,
          error: error.message
        });
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'API endpoint testing complete',
        results: results,
        workingEndpoint: results.find(r => r.success && r.eventCount > 0)?.url || null
      })
    };

  } catch (error) {
    console.error('Testing error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};
