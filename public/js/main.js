// State quản lý bộ lọc
const state = {
    q: '',
    minPrice: '',
    maxPrice: '',
    category: 'All',
    sort: 'newest',
    page: 1,
    limit: 12
};

// Khởi tạo
document.addEventListener('DOMContentLoaded', () => {
    init();
});

function init() {
    fetchCategories();
    fetchProducts();
    setupEventListeners();
}

// Cài đặt sự kiện
function setupEventListeners() {
    // Search
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');

    searchBtn.addEventListener('click', () => {
        state.q = searchInput.value;
        state.page = 1;
        fetchProducts();
    });

    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            state.q = searchInput.value;
            state.page = 1;
            fetchProducts();
        }
    });

    // Price Filter
    const applyPriceBtn = document.getElementById('applyPriceBtn');
    applyPriceBtn.addEventListener('click', () => {
        state.minPrice = document.getElementById('minPrice').value;
        state.maxPrice = document.getElementById('maxPrice').value;
        state.page = 1;
        fetchProducts();
    });

    // Sort
    const sortSelect = document.getElementById('sortSelect');
    sortSelect.addEventListener('change', (e) => {
        state.sort = e.target.value;
        state.page = 1;
        fetchProducts();
    });

    // Category delegation
    const categoryList = document.getElementById('categoryList');
    categoryList.addEventListener('click', (e) => {
        if (e.target.tagName === 'LI') {
            // Remove active class
            document.querySelectorAll('#categoryList li').forEach(li => li.classList.remove('active'));
            e.target.classList.add('active');

            state.category = e.target.dataset.cat;
            state.page = 1;
            fetchProducts();
        }
    });
}

// Fetch Danh mục
async function fetchCategories() {
    try {
        const response = await fetch('/api/products/categories');
        const data = await response.json();

        if (data.success) {
            const list = document.getElementById('categoryList');
            data.data.forEach(cat => {
                const li = document.createElement('li');
                li.textContent = cat;
                li.dataset.cat = cat;
                list.appendChild(li);
            });
        }
    } catch (error) {
        console.error('Error fetching categories:', error);
    }
}

// Fetch Sản phẩm
async function fetchProducts() {
    const grid = document.getElementById('productGrid');
    const countSpan = document.getElementById('resultsCount');

    // Show loading
    grid.innerHTML = '<div class="loading">Đang tải sản phẩm...</div>';

    try {
        // Build URL parameters
        const params = new URLSearchParams();
        if (state.q) params.append('q', state.q);
        if (state.minPrice) params.append('minPrice', state.minPrice);
        if (state.maxPrice) params.append('maxPrice', state.maxPrice);
        if (state.category && state.category !== 'All') params.append('category', state.category);
        if (state.sort) params.append('sort', state.sort);
        params.append('page', state.page);
        params.append('limit', state.limit);

        const response = await fetch(`/api/products?${params.toString()}`);
        const data = await response.json();

        if (data.success) {
            renderProducts(data.data);
            renderPagination(data.pagination);
            countSpan.textContent = `${data.pagination.totalItems} kết quả`;
        } else {
            grid.innerHTML = `<div class="error">${data.message}</div>`;
        }
    } catch (error) {
        console.error('Error fetching products:', error);
        grid.innerHTML = '<div class="error">Đã xảy ra lỗi khi tải dữ liệu.</div>';
    }
}

// Render Sản phẩm
function renderProducts(products) {
    const grid = document.getElementById('productGrid');

    if (products.length === 0) {
        grid.innerHTML = '<div class="no-results">Không tìm thấy sản phẩm nào phù hợp.</div>';
        return;
    }

    grid.innerHTML = products.map(product => {
        const formattedPrice = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(product.price);
        const oldPrice = product.originalPrice ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(product.originalPrice) : '';
        const discount = product.originalPrice ? Math.round(100 - (product.price / product.originalPrice * 100)) : 0;

        return `
            <div class="product-card">
                <div class="card-img">
                    ${discount > 0 ? `<span class="badge-sale">-${discount}%</span>` : ''}
                    <img src="${product.imageUrl}" alt="${product.name}" onerror="this.src='https://placehold.co/400x300?text=No+Image'">
                </div>
                <div class="card-body">
                    <div class="category-tag">${product.category}</div>
                    <h3 class="product-name" title="${product.name}">${product.name}</h3>
                    <div class="rating">
                        <i class="fa-solid fa-star"></i> ${product.rating}
                        <span class="sold-count">(${product.soldCount} đã bán)</span>
                    </div>
                    <div class="price-row">
                        <span class="current-price">${formattedPrice}</span>
                        ${oldPrice ? `<span class="old-price">${oldPrice}</span>` : ''}
                    </div>
                    <div class="card-actions">
                        <button class="btn-add-cart" onclick="alert('Đã thêm ${product.name} vào giỏ hàng!')">
                            <i class="fa-solid fa-cart-plus"></i> Thêm vào giỏ
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Render Phân trang
function renderPagination(pagination) {
    const container = document.getElementById('pagination');
    const { page, totalPages } = pagination;

    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    let html = '';

    // Previous
    if (page > 1) {
        html += `<button class="page-btn" onclick="goToPage(${page - 1})"><i class="fa-solid fa-chevron-left"></i></button>`;
    }

    // Pages
    for (let i = 1; i <= totalPages; i++) {
        if (i === page) {
            html += `<button class="page-btn active">${i}</button>`;
        } else {
            // Hiển thị ellipsis nếu trang quá nhiều (đơn giản hóa cho demo)
            if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
                html += `<button class="page-btn" onclick="goToPage(${i})">${i}</button>`;
            } else if (i === page - 2 || i === page + 2) {
                html += `<span class="page-ellipsis">...</span>`;
            }
        }
    }

    // Next
    if (page < totalPages) {
        html += `<button class="page-btn" onclick="goToPage(${page + 1})"><i class="fa-solid fa-chevron-right"></i></button>`;
    }

    container.innerHTML = html;
}

function goToPage(pageNum) {
    state.page = pageNum;
    fetchProducts();
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
