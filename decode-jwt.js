const jwt = process.argv[2];
if (!jwt) {
    console.log('Usage: node decode-jwt.js <jwt-token>');
    process.exit(1);
}

try {
    const parts = jwt.split('.');
    if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
    }
    
    const header = JSON.parse(Buffer.from(parts[0], 'base64').toString());
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    
    console.log('Header:', JSON.stringify(header, null, 2));
    console.log('Payload:', JSON.stringify(payload, null, 2));
    
    // Check expiration
    if (payload.exp) {
        const exp = new Date(payload.exp * 1000);
        const now = new Date();
        console.log('Expires:', exp.toISOString());
        console.log('Current time:', now.toISOString());
        console.log('Is expired:', now > exp);
    }
} catch (error) {
    console.error('Error decoding JWT:', error.message);
}