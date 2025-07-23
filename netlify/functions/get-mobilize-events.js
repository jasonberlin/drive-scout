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
    console.log('🔍 Fetching Field Team 6 events to analyze tags...');
    
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
    
    // Analyze all tags used in events
    const allTags = new Set();
    const tagCounts = {};
    const eventSamples = [];
    
    if (data.data && Array.isArray(data.data)) {
      data.data.forEach((event, index) => {
        // Collect first 10 events as samples
        if (index < 10) {
          eventSamples.push({
            id: event.id,
            title: event.title || 'Untitled',
            tags: event.tags ? event.tags.map(tag => tag.name || 'unnamed') : [],
            hasLocation: !!event.location,
            city: event.location?.locality || 'Unknown',
            state: event.location?.region || 'Unknown'
          });
        }
        
        // Check for event 815530 specifically
        if (event.id === 815530) {
          eventSamples.push({
            id: 815530,
            title: event.title || 'TARGET EVENT 815530',
            tags: event.tags ? event.tags.map(tag => tag.name || 'unnamed') : [],
            hasLocation: !!event.location,
            city: event.location?.locality || 'Unknown',
            state: event.location?.region || 'Unknown',
            isTargetEvent: true
          });
        }
        
        // Collect all unique tags
        if (event.tags && Array.isArray(event.tags)) {
          event.tags.forEach(tag => {
            const tagName = tag.name || 'unnamed';
            allTags.add(tagName);
            tagCounts[tagName] = (tagCounts[tagName] || 0) + 1;
          });
        }
      });
    }

    // Convert to arrays for JSON response
    const uniqueTags = Array.from(allTags).sort();
    
    // Find most common tags
    const sortedTags = Object.entries(tagCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 20); // Top 20 most common tags

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        totalEvents: data.data ? data.data.length : 0,
        analysis: {
          uniqueTagsCount: uniqueTags.length,
          allUniqueTags: uniqueTags,
          topTags: sortedTags,
          eventSamples: eventSamples
        },
        searchInfo: {
          lookingFor: "Drive",
          foundDriveTag: uniqueTags.includes('Drive'),
          foundTargetEvent: eventSamples.some(e => e.id === 815530),
          possibleAlternatives: uniqueTags.filter(tag => 
            tag.toLowerCase().includes('drive') || 
            tag.toLowerCase().includes('voter') ||
            tag.toLowerCase().includes('registration')
          )
        }
      })
    };

  } catch (error) {
    console.error('❌ Error analyzing events:', error.message);
    
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
