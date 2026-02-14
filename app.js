// Dashboard Ordini Genuine Leather - App JS

let allOrders = [];
let filteredOrders = [];
let charts = {};

// Colori per i siti
const siteColors = {
    IT: '#27ae60',
    FR: '#3498db',
    ES: '#f39c12'
};

// Inizializzazione
document.addEventListener('DOMContentLoaded', async () => {
    setupFilters();
    await loadData();
});

// Setup filtri
function setupFilters() {
    document.querySelectorAll('#periodFilter button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('#periodFilter button').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            applyFilters();
        });
    });

    document.querySelectorAll('#siteFilter button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('#siteFilter button').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            applyFilters();
        });
    });
}

// Carica dati
async function loadData() {
    try {
        const response = await fetch('data/orders.json');
        if (!response.ok) throw new Error('Dati non disponibili');

        const data = await response.json();
        allOrders = data.orders || [];

        // Aggiorna timestamp
        const lastUpdate = new Date(data.stats?.last_update);
        document.getElementById('lastUpdate').textContent =
            `Ultimo aggiornamento: ${formatDate(lastUpdate)} ${formatTime(lastUpdate)}`;

        applyFilters();
    } catch (error) {
        console.error('Errore caricamento dati:', error);
        document.getElementById('lastUpdate').textContent = 'Errore caricamento dati';
    }
}

// Applica filtri
function applyFilters() {
    const period = document.querySelector('#periodFilter button.active').dataset.period;
    const site = document.querySelector('#siteFilter button.active').dataset.site;

    let orders = [...allOrders];

    // Filtro periodo
    if (period !== 'all') {
        const days = parseInt(period);
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        orders = orders.filter(o => new Date(o.date_created) >= cutoff);
    }

    // Filtro sito
    if (site !== 'all') {
        orders = orders.filter(o => o.site === site);
    }

    filteredOrders = orders;
    updateDashboard();
}

// Aggiorna dashboard
function updateDashboard() {
    updateKPIs();
    updateSiteKPIs();
    updateCharts();
    updateTables();
}

// Aggiorna KPI principali
function updateKPIs() {
    const completedStatuses = ['completed', 'processing'];
    const validOrders = filteredOrders.filter(o => completedStatuses.includes(o.status));

    const totalRevenue = validOrders.reduce((sum, o) => sum + o.total, 0);
    const totalOrders = validOrders.length;
    const avgOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    const uniqueEmails = new Set(validOrders.map(o => o.customer?.email).filter(Boolean));

    document.getElementById('totalRevenue').textContent = formatCurrency(totalRevenue);
    document.getElementById('totalOrders').textContent = totalOrders.toLocaleString('it-IT');
    document.getElementById('avgOrder').textContent = formatCurrency(avgOrder);
    document.getElementById('uniqueCustomers').textContent = uniqueEmails.size.toLocaleString('it-IT');
}

// Aggiorna KPI per sito
function updateSiteKPIs() {
    const completedStatuses = ['completed', 'processing'];

    ['IT', 'FR', 'ES'].forEach(site => {
        const siteOrders = filteredOrders.filter(o =>
            o.site === site && completedStatuses.includes(o.status)
        );
        const revenue = siteOrders.reduce((sum, o) => sum + o.total, 0);

        document.getElementById(`revenue${site}`).textContent = formatCurrency(revenue);
        document.getElementById(`orders${site}`).textContent = `${siteOrders.length} ordini`;
    });
}

// Aggiorna grafici
function updateCharts() {
    updateOrdersChart();
    updateRevenuePieChart();
    updateBrandsChart();
    updatePaymentChart();
    updateProductsChart();
}

// Grafico ordini nel tempo
function updateOrdersChart() {
    const ctx = document.getElementById('ordersChart').getContext('2d');

    // Raggruppa per giorno
    const ordersByDate = {};
    const completedStatuses = ['completed', 'processing'];

    filteredOrders.filter(o => completedStatuses.includes(o.status)).forEach(order => {
        const date = order.date_created.split('T')[0];
        if (!ordersByDate[date]) {
            ordersByDate[date] = { count: 0, revenue: 0 };
        }
        ordersByDate[date].count++;
        ordersByDate[date].revenue += order.total;
    });

    const dates = Object.keys(ordersByDate).sort();
    const counts = dates.map(d => ordersByDate[d].count);
    const revenues = dates.map(d => ordersByDate[d].revenue);

    if (charts.orders) charts.orders.destroy();

    charts.orders = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates.map(d => formatDateShort(new Date(d))),
            datasets: [
                {
                    label: 'Ordini',
                    data: counts,
                    borderColor: '#3498db',
                    backgroundColor: 'rgba(52, 152, 219, 0.1)',
                    fill: true,
                    tension: 0.3,
                    yAxisID: 'y'
                },
                {
                    label: 'Fatturato',
                    data: revenues,
                    borderColor: '#27ae60',
                    backgroundColor: 'transparent',
                    borderDash: [5, 5],
                    tension: 0.3,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: { display: true, text: 'Ordini' }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: { display: true, text: 'Fatturato (EUR)' },
                    grid: { drawOnChartArea: false }
                }
            },
            plugins: {
                legend: { position: 'top' }
            }
        }
    });
}

// Pie chart fatturato per sito
function updateRevenuePieChart() {
    const ctx = document.getElementById('revenuePieChart').getContext('2d');
    const completedStatuses = ['completed', 'processing'];

    const revenueBySite = { IT: 0, FR: 0, ES: 0 };
    filteredOrders.filter(o => completedStatuses.includes(o.status)).forEach(order => {
        if (revenueBySite.hasOwnProperty(order.site)) {
            revenueBySite[order.site] += order.total;
        }
    });

    if (charts.revenuePie) charts.revenuePie.destroy();

    charts.revenuePie = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Italia', 'Francia', 'Spagna'],
            datasets: [{
                data: [revenueBySite.IT, revenueBySite.FR, revenueBySite.ES],
                backgroundColor: [siteColors.IT, siteColors.FR, siteColors.ES],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `${ctx.label}: ${formatCurrency(ctx.raw)}`
                    }
                }
            }
        }
    });
}

// Grafico brand
function updateBrandsChart() {
    const ctx = document.getElementById('brandsChart').getContext('2d');
    const completedStatuses = ['completed', 'processing'];

    const brandSales = {};
    filteredOrders.filter(o => completedStatuses.includes(o.status)).forEach(order => {
        order.items?.forEach(item => {
            const brand = item.brand || 'N/D';
            if (!brandSales[brand]) brandSales[brand] = 0;
            brandSales[brand] += item.total;
        });
    });

    const sorted = Object.entries(brandSales)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    if (charts.brands) charts.brands.destroy();

    charts.brands = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sorted.map(([brand]) => brand),
            datasets: [{
                label: 'Vendite',
                data: sorted.map(([, value]) => value),
                backgroundColor: '#3498db',
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => formatCurrency(ctx.raw)
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        callback: (value) => formatCurrencyShort(value)
                    }
                }
            }
        }
    });
}

// Grafico metodi pagamento
function updatePaymentChart() {
    const ctx = document.getElementById('paymentChart').getContext('2d');
    const completedStatuses = ['completed', 'processing'];

    const paymentMethods = {};
    filteredOrders.filter(o => completedStatuses.includes(o.status)).forEach(order => {
        const method = order.payment_method_title || order.payment_method || 'N/D';
        if (!paymentMethods[method]) paymentMethods[method] = 0;
        paymentMethods[method]++;
    });

    const sorted = Object.entries(paymentMethods).sort((a, b) => b[1] - a[1]);
    const colors = ['#3498db', '#27ae60', '#f39c12', '#e74c3c', '#9b59b6', '#1abc9c'];

    if (charts.payment) charts.payment.destroy();

    charts.payment = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: sorted.map(([method]) => method),
            datasets: [{
                data: sorted.map(([, count]) => count),
                backgroundColor: colors,
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}

// Grafico prodotti
function updateProductsChart() {
    const ctx = document.getElementById('productsChart').getContext('2d');
    const completedStatuses = ['completed', 'processing'];

    const productSales = {};
    filteredOrders.filter(o => completedStatuses.includes(o.status)).forEach(order => {
        order.items?.forEach(item => {
            const name = item.name || 'N/D';
            if (!productSales[name]) productSales[name] = { qty: 0, revenue: 0 };
            productSales[name].qty += item.quantity;
            productSales[name].revenue += item.total;
        });
    });

    const sorted = Object.entries(productSales)
        .sort((a, b) => b[1].revenue - a[1].revenue)
        .slice(0, 10);

    if (charts.products) charts.products.destroy();

    charts.products = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sorted.map(([name]) => truncate(name, 40)),
            datasets: [{
                label: 'Fatturato',
                data: sorted.map(([, data]) => data.revenue),
                backgroundColor: '#27ae60',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const item = sorted[ctx.dataIndex];
                            return `${formatCurrency(item[1].revenue)} (${item[1].qty} pz)`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    ticks: {
                        callback: (value) => formatCurrencyShort(value)
                    }
                }
            }
        }
    });
}

// Aggiorna tabelle
function updateTables() {
    updateRecentOrdersTable();
    updateTopCustomersTable();
}

// Tabella ultimi ordini
function updateRecentOrdersTable() {
    const tbody = document.querySelector('#recentOrdersTable tbody');
    const orders = [...filteredOrders]
        .sort((a, b) => new Date(b.date_created) - new Date(a.date_created))
        .slice(0, 50);

    tbody.innerHTML = orders.map(order => `
        <tr>
            <td>${formatDate(new Date(order.date_created))}</td>
            <td>#${order.number}</td>
            <td><span class="site-badge" style="border-left: 3px solid ${siteColors[order.site]}">${order.site}</span></td>
            <td>${order.customer?.first_name || ''} ${order.customer?.last_name || ''}</td>
            <td>${formatCurrency(order.total)}</td>
            <td><span class="status-badge status-${order.status}">${translateStatus(order.status)}</span></td>
        </tr>
    `).join('');
}

// Tabella top clienti
function updateTopCustomersTable() {
    const tbody = document.querySelector('#topCustomersTable tbody');
    const completedStatuses = ['completed', 'processing'];

    const customers = {};
    filteredOrders.filter(o => completedStatuses.includes(o.status)).forEach(order => {
        const email = order.customer?.email;
        if (!email) return;

        if (!customers[email]) {
            customers[email] = {
                name: `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim(),
                orders: 0,
                total: 0
            };
        }
        customers[email].orders++;
        customers[email].total += order.total;
    });

    const sorted = Object.entries(customers)
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 20);

    tbody.innerHTML = sorted.map(([email, data], i) => `
        <tr>
            <td>${i + 1}</td>
            <td>${data.name || email}</td>
            <td>${data.orders}</td>
            <td>${formatCurrency(data.total)}</td>
        </tr>
    `).join('');
}

// Utility functions
function formatCurrency(value) {
    return new Intl.NumberFormat('it-IT', {
        style: 'currency',
        currency: 'EUR'
    }).format(value);
}

function formatCurrencyShort(value) {
    if (value >= 1000) {
        return (value / 1000).toFixed(1) + 'k';
    }
    return value.toFixed(0);
}

function formatDate(date) {
    return date.toLocaleDateString('it-IT');
}

function formatDateShort(date) {
    return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
}

function formatTime(date) {
    return date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

function truncate(str, len) {
    return str.length > len ? str.substring(0, len) + '...' : str;
}

function translateStatus(status) {
    const translations = {
        'completed': 'Completato',
        'processing': 'In elaborazione',
        'pending': 'In attesa',
        'on-hold': 'In sospeso',
        'cancelled': 'Annullato',
        'refunded': 'Rimborsato',
        'failed': 'Fallito'
    };
    return translations[status] || status;
}
