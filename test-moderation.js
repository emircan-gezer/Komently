const axios = require('axios');

async function testModeration() {
    const sectionId = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d'; // Example publicId (need a real one from DB)
    const token = 'YOUR_COMMENTER_TOKEN'; // Need a real token
    const url = `http://localhost:3000/api/comments/${sectionId}/post`;

    const headers = {
        'x-commenter-token': token,
        'Content-Type': 'application/json'
    };

    console.log('--- Testing Duplicate Detection ---');
    try {
        const body = { body: "This is a test comment 1" };
        const res1 = await axios.post(url, body, { headers });
        console.log('Post 1:', res1.status);
        
        const res2 = await axios.post(url, body, { headers });
        console.log('Post 2 (expected 422):', res2.status);
    } catch (err) {
        console.log('Error as expected:', err.response?.status, err.response?.data);
    }

    console.log('\n--- Testing Rate Limiting ---');
    try {
        const body = { body: "This is a unique test comment " + Date.now() };
        const res1 = await axios.post(url, body, { headers });
        console.log('Unique Post:', res1.status);
        
        const body2 = { body: "Another unique comment " + Date.now() };
        const res2 = await axios.post(url, body2, { headers });
        console.log('Quick Post (expected 429):', res2.status);
    } catch (err) {
        console.log('Error as expected:', err.response?.status, err.response?.data);
    }
}

// testModeration();
