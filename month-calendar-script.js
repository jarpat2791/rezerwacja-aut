// Skrypt dla kalendarza miesiąca

document.addEventListener('DOMContentLoaded', function() {
    // Sprawdź czy użytkownik jest zalogowany
    const user = JSON.parse(localStorage.getItem('currentUser'));
    
    if (!user || (user.role !== 'admin' && user.login !== 'admin')) {
        alert('Brak uprawnień do przeglądania kalendarza miesiąca!');
        window.location.href = 'index.html';
        return;
    }
    
    // Ustaw nazwę użytkownika
    document.getElementById('userDisplay').textContent = `Zalogowany jako: ${user.name}`;
    
    // Załaduj rezerwacje
    loadReservationsForCalendar();
    
    // Inicjalizuj kalendarz (już zainicjalizowany w głównym script.js)
    if (typeof initMonthCalendar === 'function') {
        initMonthCalendar();
    }
    
    // Załaduj statystyki
    updateMonthStats();
    
    // Aktualizuj datę ostatniej aktualizacji
    updateLastUpdate();
});

// Załaduj rezerwacje dla kalendarza
function loadReservationsForCalendar() {
    const savedReservations = localStorage.getItem('carReservations');
    if (savedReservations) {
        reservations = JSON.parse(savedReservations);
    }
}

// Aktualizuj statystyki miesiąca
function updateMonthStats() {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    
    const report = generateMonthlyReport(currentMonth, currentYear);
    const statsContainer = document.getElementById('monthStats');
    
    if (!statsContainer) return;
    
    let carsHtml = '';
    Object.keys(report.byCar).forEach(carId => {
        const car = CARS.find(c => c.id === carId) || { name: carId };
        const carStats = report.byCar[carId];
        carsHtml += `
            <div class="stat-item">
                <h4><i class="fas fa-car"></i> ${car.name}</h4>
                <p>Rezerwacji: <strong>${carStats.count}</strong></p>
                <p>Dni: <strong>${carStats.days}</strong></p>
            </div>
        `;
    });
    
    statsContainer.innerHTML = `
        <div class="stat-item">
            <h4><i class="fas fa-chart-pie"></i> Podsumowanie miesiąca</h4>
            <p class="report-stat">${report.totalReservations}</p>
            <p class="report-label">Łącznie rezerwacji</p>
            <p class="report-stat">${report.totalDays}</p>
            <p class="report-label">Łączna liczba dni</p>
        </div>
        <div class="stat-item">
            <h4><i class="fas fa-building"></i> Według działów</h4>
            ${Object.keys(report.byDepartment).map(dept => {
                const deptStats = report.byDepartment[dept];
                return `<p>${dept}: ${deptStats.count} rezerwacji (${deptStats.days} dni)</p>`;
            }).join('') || '<p>Brak danych</p>'}
        </div>
        ${carsHtml}
    `;
}

// Eksport kalendarza do PDF
function exportMonthCalendarPDF() {
    const now = new Date();
    const monthNames = [
        'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
        'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
    ];
    const currentMonth = monthNames[now.getMonth()];
    const currentYear = now.getFullYear();
    
    // Pobierz zawartość kalendarza
    const calendarContent = document.querySelector('.month-calendar-container').innerHTML;
    const statsContent = document.getElementById('monthStats').innerHTML;
    
    const fullContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Kalendarz rezerwacji - ${currentMonth} ${currentYear}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                h1 { color: #2a5298; }
                .calendar-container { margin: 20px 0; }
                .stats-container { margin-top: 30px; }
                table { width: 100%; border-collapse: collapse; margin: 10px 0; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; }
                .reserved { background-color: #e74c3c; color: white; }
                .my-reservation { background-color: #3498db; color: white; }
            </style>
        </head>
        <body>
            <h1>Kalendarz rezerwacji aut - ${currentMonth} ${currentYear}</h1>
            <p>Wygenerowano: ${new Date().toLocaleString('pl-PL')}</p>
            <div class="calendar-container">
                ${calendarContent}
            </div>
            <div class="stats-container">
                <h2>Statystyki miesiąca</h2>
                ${statsContent}
            </div>
        </body>
        </html>
    `;
    
    // Eksportuj jako PDF (w rzeczywistości użyj biblioteki jsPDF)
    exportToPDF(fullContent, `kalendarz-${currentMonth.toLowerCase()}-${currentYear}.pdf`);
    showMessage('monthStats', 'Eksport do PDF rozpoczęty!', 'success');
}

// Drukuj kalendarz
function printMonthCalendar() {
    window.print();
}

// Aktualizuj datę ostatniej aktualizacji
function updateLastUpdate() {
    const lastUpdateElement = document.getElementById('lastUpdate');
    if (lastUpdateElement) {
        lastUpdateElement.textContent = `Ostatnia aktualizacja: ${new Date().toLocaleString('pl-PL')}`;
    }
}

// Funkcje z głównego script.js
if (typeof showMessage === 'undefined') {
    function showMessage(elementId, message, type = "info") {
        console.log(message);
    }
}

if (typeof exportToPDF === 'undefined') {
    function exportToPDF(content, filename) {
        alert('Eksport do PDF: ' + filename);
        console.log('Zawartość PDF:', content);
    }
}

if (typeof generateMonthlyReport === 'undefined') {
    function generateMonthlyReport(month, year) {
        return { totalReservations: 0, totalDays: 0, byCar: {}, byDepartment: {} };
    }
}