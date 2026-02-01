const http = require('http');

const get = (url) => {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve({ statusCode: res.statusCode, data }));
        }).on('error', reject);
    });
};

async function test() {
    try {
        console.log('Testing Home Page (HTML)...');
        const home = await get('http://localhost:3001/');
        console.log('Status:', home.statusCode);
        console.log('Contains "Đặc Sản Việt":', home.data.includes('Đặc Sản Việt'));
        console.log('---');

        console.log('Testing Get Products...');
        const products = await get('http://localhost:3001/api/products');
        console.log('Status:', products.statusCode);
        const prodData = JSON.parse(products.data);
        console.log('Success:', prodData.success);
        console.log('Count:', prodData.data ? prodData.data.length : 0);
        console.log('---');

        console.log('Testing Search (q=Robusta)...');
        const search = await get('http://localhost:3001/api/products?q=Robusta');
        console.log('Status:', search.statusCode);
        const searchData = JSON.parse(search.data);
        console.log('Success:', searchData.success);
        if (searchData.data && searchData.data.length > 0) {
            console.log('First Result:', searchData.data[0].name);
        } else {
            console.log('No results found');
        }
        console.log('---');

        console.log('Testing Categories...');
        const cats = await get('http://localhost:3001/api/products/categories');
        console.log('Status:', cats.statusCode);
        const catData = JSON.parse(cats.data);
        console.log('Categories:', catData.data);

    } catch (err) {
        console.error('Test failed:', err.message);
    }
}

test();
