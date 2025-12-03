// reservations-management-script.js
// Skrypt do zarządzania rezerwacjami - wersja uproszczona

// Dane aut
const CARS = [
    { id: "Auto1", name: "Skoda Octavia 1", plate: "RZ 12345" },
    { id: "Auto2", name: "Skoda Octavia 2", plate: "RZ 23456" },
    { id: "Auto3", name: "Skoda Octavia 3", plate: "RZ 34567"},
    { id: "Auto4", name: "Skoda Superb", plate: "RZ 45678"},
    { id: "Auto5", name: "Hyundai Tucson 1", plate: "RZ 56789" },
    { id: "Auto6", name: "Hyundai Tucson 2", plate: "RZ 67890" }
];

// Zmienne globalne
let allReservations = [];
let filteredReservations = [];
let datePicker = null;

// Inicjalizacja po załadowaniu strony
document.addEventListener('DOMContentLoaded', function() {
    initDatePicker();
    loadReservations();
    setupEventListeners();
    updateLastUpdateTime();
});

// Inicjalizacja kalendarza dla filtrowania
function initDatePicker() {
    datePicker = flatpickr("#filterDateRange", {
        mode: "range",
        dateFormat: "Y-m-d",
        locale: "pl",
        allowInput: false,
        altInput: true,
        altFormat: "d.m.Y",
        ariaDateFormat: "d.m.Y"
    });
}

// Ładowanie rezerwacji z localStorage
function loadReservations() {
    const savedReservations = localStorage.getItem('carReservations');
    
    if (savedReservations) {
        allReservations = JSON.parse(savedReservations);
        
        // Dodaj pole displayStatus dla łatwiejszego filtrowania
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        allReservations = allReservations.map(reservation => {
            const endDate = parseLocalDate(reservation.endDate);
            const isCompleted = endDate < today && reservation.status === 'active';
            
            return {
                ...reservation,
                displayStatus: isCompleted ? 'completed' : reservation.status
            };
        });
        
        applyFilters();
    } else {
        allReservations = [];
        filteredReservations = [];
        updateReservationsTable();
        updateSummaryStats();
    }
}

// Ustawienie obsługi zdarzeń
function setupEventListeners() {
    // Przyciski filtrowania
    document.getElementById('applyFilter').addEventListener('click', applyFilters);
    document.getElementById('resetFilter').addEventListener('click', resetFilters);
    
    // Obsługa modalu
    const modal = document.getElementById('reservationModal');
    const closeModalBtn = document.querySelector('.close-modal');
    
    closeModalBtn.addEventListener('click', function() {
        modal.classList.add('hidden');
    });
    
    // Zamykanie modala po kliknięciu poza nim
    modal.addEventListener('click', function(event) {
        if (event.target === modal) {
            modal.classList.add('hidden');
        }
    });
    
    // Przycisk powrotu
    document.querySelector('.btn-logout').addEventListener('click', function() {
        window.location.href = 'index.html';
    });
}

// Zastosowanie filtrów
function applyFilters() {
    const carFilter = document.getElementById('filterCar').value;
    const employeeFilter = document.getElementById('filterEmployee').value.toLowerCase();
    const dateRange = datePicker.selectedDates;
    
    filteredReservations = allReservations.filter(reservation => {
        // Filtruj po aucie
        if (carFilter && reservation.carId !== carFilter) {
            return false;
        }
        
        // Filtruj po pracowniku
        if (employeeFilter && !reservation.employeeName.toLowerCase().includes(employeeFilter)) {
            return false;
        }
        
        // Filtruj po zakresie dat
        if (dateRange && dateRange.length === 2) {
            const startFilter = getDateOnly(dateRange[0]);
            const endFilter = getDateOnly(dateRange[1]);
            
            const startReservation = parseLocalDate(reservation.startDate);
            const endReservation = parseLocalDate(reservation.endDate);
            
            // Sprawdź czy rezerwacja nakłada się z filtrem dat
            if (!(endReservation >= startFilter && startReservation <= endFilter)) {
                return false;
            }
        }
        
        return true;
    });
    
    // Sortuj od najnowszych
    filteredReservations.sort((a, b) => {
        const dateA = parseLocalDate(a.bookingDate || a.startDate);
        const dateB = parseLocalDate(b.bookingDate || b.startDate);
        return dateB - dateA;
    });
    
    updateReservationsTable();
    updateSummaryStats();
}

// Resetowanie filtrów
function resetFilters() {
    document.getElementById('filterCar').value = '';
    document.getElementById('filterEmployee').value = '';
    datePicker.clear();
    
    applyFilters();
}

// Aktualizacja tabeli rezerwacji
function updateReservationsTable() {
    const tableBody = document.getElementById('reservationsTableBody');
    
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    if (filteredReservations.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td colspan="7" style="text-align: center; padding: 40px;">
                <i class="fas fa-info-circle" style="font-size: 48px; color: #ccc; margin-bottom: 15px; display: block;"></i>
                <p style="color: #666; font-style: italic;">Brak rezerwacji spełniających kryteria wyszukiwania</p>
            </td>
        `;
        tableBody.appendChild(row);
        return;
    }
    
    filteredReservations.forEach(reservation => {
        const row = document.createElement('tr');
        
        // Określ status
        const statusClass = getStatusClass(reservation.displayStatus || reservation.status);
        const statusText = getStatusText(reservation.displayStatus || reservation.status);
        
        // Znajdź nazwę auta
        const car = CARS.find(c => c.id === reservation.carId);
        const carName = car ? `${car.name} (${car.plate})` : reservation.carId;
        
        // Formatuj daty
        const startDate = formatDate(reservation.startDate);
        const endDate = formatDate(reservation.endDate);
        
        row.innerHTML = `
            <td>${reservation.id.substring(0, 8)}...</td>
            <td>${carName}</td>
            <td>${reservation.employeeName}</td>
            <td>${startDate} - ${endDate}</td>
            <td title="${reservation.purpose}">${reservation.purpose.substring(0, 30)}${reservation.purpose.length > 30 ? '...' : ''}</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td>
                <div class="action-buttons">
                    <button class="btn-view-small" onclick="viewReservation('${reservation.id}')" title="Podgląd">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-edit-small" onclick="editReservation('${reservation.id}')" title="Edytuj">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-delete-small" onclick="deleteReservation('${reservation.id}')" title="Usuń">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
}

// Aktualizacja statystyk podsumowania
function updateSummaryStats() {
    const summaryElement = document.getElementById('summaryStats');
    
    if (!summaryElement) return;
    
    const total = allReservations.length;
    const active = allReservations.filter(r => r.displayStatus === 'active').length;
    const completed = allReservations.filter(r => r.displayStatus === 'completed').length;
    const cancelled = allReservations.filter(r => r.status === 'cancelled').length;
    const filtered = filteredReservations.length;
    
    summaryElement.innerHTML = `
        <div class="stat-item">
            <div class="stat-icon" style="background: #3498db;">
                <i class="fas fa-list"></i>
            </div>
            <div class="stat-info">
                <h4>Wszystkie rezerwacje</h4>
                <p>${total}</p>
            </div>
        </div>
        <div class="stat-item">
            <div class="stat-icon" style="background: #2ecc71;">
                <i class="fas fa-check-circle"></i>
            </div>
            <div class="stat-info">
                <h4>Aktywne</h4>
                <p>${active}</p>
            </div>
        </div>
        <div class="stat-item">
            <div class="stat-icon" style="background: #f39c12;">
                <i class="fas fa-calendar-check"></i>
            </div>
            <div class="stat-info">
                <h4>Zakończone</h4>
                <p>${completed}</p>
            </div>
        </div>
        <div class="stat-item">
            <div class="stat-icon" style="background: #e74c3c;">
                <i class="fas fa-times-circle"></i>
            </div>
            <div class="stat-info">
                <h4>Anulowane</h4>
                <p>${cancelled}</p>
            </div>
        </div>
        <div class="stat-item">
            <div class="stat-icon" style="background: #9b59b6;">
                <i class="fas fa-filter"></i>
            </div>
            <div class="stat-info">
                <h4>Filtrowane</h4>
                <p>${filtered}</p>
            </div>
        </div>
    `;
}

// Podgląd rezerwacji
function viewReservation(reservationId) {
    const reservation = allReservations.find(r => r.id === reservationId);
    
    if (!reservation) {
        showNotification('Rezerwacja nie została znaleziona', 'error');
        return;
    }
    
    const car = CARS.find(c => c.id === reservation.carId);
    const carName = car ? `${car.name} (${car.plate})` : reservation.carId;
    
    const detailsHtml = `
        <div class="reservation-details">
            <div class="detail-row">
                <strong>ID rezerwacji:</strong> ${reservation.id}
            </div>
            <div class="detail-row">
                <strong>Auto:</strong> ${carName}
            </div>
            <div class="detail-row">
                <strong>Pracownik:</strong> ${reservation.employeeName}
            </div>
            <div class="detail-row">
                <strong>Dział:</strong> ${reservation.department}
            </div>
            <div class="detail-row">
                <strong>Okres rezerwacji:</strong> ${formatDate(reservation.startDate)} - ${formatDate(reservation.endDate)}
            </div>
            <div class="detail-row">
                <strong>Liczba dni:</strong> ${reservation.daysCount || 1}
            </div>
            <div class="detail-row">
                <strong>Cel wyjazdu:</strong> ${reservation.purpose}
            </div>
            <div class="detail-row">
                <strong>Data rezerwacji:</strong> ${formatDate(reservation.bookingDate || reservation.startDate)}
            </div>
            <div class="detail-row">
                <strong>Status:</strong> <span class="status-badge ${getStatusClass(reservation.displayStatus || reservation.status)}">${getStatusText(reservation.displayStatus || reservation.status)}</span>
            </div>
            ${reservation.cancelledDate ? `
                <div class="detail-row">
                    <strong>Data anulowania:</strong> ${formatDate(reservation.cancelledDate)}
                </div>
                <div class="detail-row">
                    <strong>Anulowane przez:</strong> ${reservation.cancelledBy || 'Nieznany'}
                </div>
            ` : ''}
            ${reservation.login ? `
                <div class="detail-row">
                    <strong>Login użytkownika:</strong> ${reservation.login}
                </div>
            ` : ''}
        </div>
    `;
    
    document.getElementById('reservationDetails').innerHTML = detailsHtml;
    document.getElementById('modalReservationTitle').textContent = `Szczegóły rezerwacji: ${carName}`;
    document.getElementById('reservationModal').classList.remove('hidden');
}

// Edycja rezerwacji
function editReservation(reservationId) {
    // Przekieruj do głównej strony z parametrem edycji
    localStorage.setItem('editReservationId', reservationId);
    window.location.href = 'index.html';
}

// Usuwanie rezerwacji
function deleteReservation(reservationId) {
    if (!confirm('Czy na pewno chcesz trwale usunąć tę rezerwację?\n\nTa operacja jest nieodwracalna!')) {
        return;
    }
    
    const index = allReservations.findIndex(r => r.id === reservationId);
    
    if (index !== -1) {
        const reservation = allReservations[index];
        
        // Usuń rezerwację
        allReservations.splice(index, 1);
        
        // Zapisz do localStorage
        localStorage.setItem('carReservations', JSON.stringify(allReservations.filter(r => r.status !== 'cancelled')));
        
        // Odśwież listę
        loadReservations();
        
        // Pokaż komunikat
        showNotification(`Rezerwacja auta ${reservation.carId} została usunięta`, 'success');
    } else {
        showNotification('Rezerwacja nie została znaleziona', 'error');
    }
}

// Pomocnicze funkcje

function getStatusClass(status) {
    switch(status) {
        case 'active': return 'status-active';
        case 'cancelled': return 'status-cancelled';
        case 'completed': return 'status-completed';
        default: return 'status-unknown';
    }
}

function getStatusText(status) {
    switch(status) {
        case 'active': return 'Aktywna';
        case 'cancelled': return 'Anulowana';
        case 'completed': return 'Zakończona';
        default: return status;
    }
}

function showNotification(message, type = 'info') {
    // Sprawdź czy już istnieje powiadomienie
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        document.body.removeChild(existingNotification);
    }
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#e74c3c' : '#3498db'};
        color: white;
        border-radius: 4px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        z-index: 1000;
        display: flex;
        align-items: center;
        gap: 10px;
        animation: slideIn 0.3s ease-out;
    `;
    
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    // Automatyczne ukrycie po 5 sekundach
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => {
                if (notification.parentNode) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }
    }, 5000);
    
    // Dodaj style animacji jeśli nie istnieją
    if (!document.getElementById('notificationStyles')) {
        const style = document.createElement('style');
        style.id = 'notificationStyles';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
}

function updateLastUpdateTime() {
    const lastUpdateElement = document.getElementById('lastUpdate');
    if (lastUpdateElement) {
        lastUpdateElement.textContent = `Ostatnia aktualizacja: ${new Date().toLocaleString('pl-PL')}`;
    }
}

// Funkcje pomocnicze do obsługi dat (z głównego skryptu)

function parseLocalDate(dateString) {
    if (!dateString) return null;
    
    if (dateString.includes('-')) {
        const [year, month, day] = dateString.split('-').map(Number);
        return new Date(year, month - 1, day, 12, 0, 0);
    } else if (dateString.includes('.')) {
        const [day, month, year] = dateString.split('.').map(Number);
        return new Date(year, month - 1, day, 12, 0, 0);
    }
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return null;
    
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
}

function formatDate(dateString) {
    const date = parseLocalDate(dateString);
    if (!date) return 'Nieprawidłowa data';
    
    return date.toLocaleDateString('pl-PL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

function getDateOnly(date) {
    if (!date) return null;
    const d = new Date(date);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// Eksport funkcji do globalnego zakresu
window.viewReservation = viewReservation;
window.editReservation = editReservation;
window.deleteReservation = deleteReservation;
