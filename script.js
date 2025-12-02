// Dane logowania (w rzeczywistości należy użyć bezpiecznego systemu uwierzytelniania)
const VALID_USERS = [
    { login: "pracownik1", password: "haslo123", name: "Jan Kowalski", role: "user" },
    { login: "pracownik2", password: "haslo456", name: "Anna Nowak", role: "user" },
    { login: "pracownik3", password: "haslo789", name: "Piotr Wiśniewski", role: "user" },
    { login: "admin", password: "admin123", name: "Administrator", role: "admin" }
];

// Dane aut
const CARS = [
    { id: "Auto1", name: "Toyota Corolla", plate: "KR 12345" },
    { id: "Auto2", name: "Volkswagen Passat", plate: "KR 23456" },
    { id: "Auto3", name: "Skoda Octavia", plate: "KR 34567" },
    { id: "Auto4", name: "Ford Focus", plate: "KR 45678" },
    { id: "Auto5", name: "Opel Astra", plate: "KR 56789" },
    { id: "Auto6", name: "Hyundai i30", plate: "KR 67890" }
];

// URL Google Apps Script (do zastąpienia własnym)
const GOOGLE_SCRIPT_URL = "TUTAJ_WPISZ_URL_TWOJEGO_GOOGLE_APPS_SCRIPT";

// Zmienne globalne
let currentUser = null;
let selectedCar = null;
let flatpickrInstance = null;
let reservations = [];
let editingReservationId = null;

// Funkcje pomocnicze
function getCurrentUser() {
    return JSON.parse(localStorage.getItem('currentUser'));
}

function setCurrentUser(user) {
    localStorage.setItem('currentUser', JSON.stringify(user));
    currentUser = user;
}

function clearCurrentUser() {
    localStorage.removeItem('currentUser');
    currentUser = null;
}

function showMessage(elementId, message, type = "info") {
    const messageElement = document.getElementById(elementId);
    messageElement.textContent = message;
    messageElement.className = `message ${type}`;
    messageElement.style.display = 'block';
    
    if (type === "success") {
        setTimeout(() => {
            messageElement.style.display = 'none';
        }, 5000);
    }
}

function generateReservationId() {
    return 'RES-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

// Obsługa logowania
if (document.getElementById('loginForm')) {
    document.getElementById('loginForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const login = document.getElementById('login').value;
        const password = document.getElementById('password').value;
        
        // Najpierw sprawdź w localStorage (jeśli istnieją zaktualizowane dane)
        let user = null;
        const savedUsers = localStorage.getItem('systemUsers');
        
        if (savedUsers) {
            const users = JSON.parse(savedUsers);
            user = users.find(u => u.login === login && u.password === password);
        }
        
        // Jeśli nie znaleziono w localStorage, sprawdź domyślną listę
        if (!user) {
            user = VALID_USERS.find(u => u.login === login && u.password === password);
        }
        
        if (user) {
            setCurrentUser(user);
            window.location.href = 'index.html';
        } else {
            showMessage('loginMessage', 'Nieprawidłowy login lub hasło', 'error');
        }
    });
}

// Obsługa wylogowania
if (document.getElementById('logoutBtn')) {
    document.getElementById('logoutBtn').addEventListener('click', function() {
        clearCurrentUser();
        window.location.href = 'login.html';
    });
}

// Inicjalizacja głównej strony
if (document.getElementById('employeeName')) {
    document.addEventListener('DOMContentLoaded', function() {
        // Sprawdź czy użytkownik jest zalogowany
        const user = getCurrentUser();
        
        if (!user) {
            window.location.href = 'login.html';
            return;
        }
        
        // Ustaw informacje o użytkowniku
        document.getElementById('username').textContent = user.name;
        document.getElementById('employeeName').value = user.name;
        
        // Dodaj link do zmiany hasła
        addPasswordChangeLink();
        
        // Dodaj link do panelu administracyjnego dla admina
        if (user.role === 'admin' || user.login === 'admin') {
            addAdminPanelLink();
            addReservationsManagementLink();
        }
        
        // Inicjalizuj kalendarz
        initCalendar();
        
        // Załaduj rezerwacje
        loadReservations();
        
        // Obsługa zmiany wyboru auta
        document.getElementById('carSelect').addEventListener('change', function() {
            selectedCar = this.value;
            const calendarSection = document.getElementById('calendarSection');
            
            if (selectedCar) {
                calendarSection.classList.remove('hidden');
                updateCalendarAvailability();
            } else {
                calendarSection.classList.add('hidden');
            }
        });
        
        // Obsługa formularza rezerwacji
        document.getElementById('reservationForm').addEventListener('submit', function(e) {
            e.preventDefault();
            submitReservation();
        });
        
        // Załaduj dane z Google Sheets (symulacja)
        loadDataFromGoogleSheets();
    });
}

// Dodaj link do zmiany hasła
function addPasswordChangeLink() {
    const userInfo = document.querySelector('.user-info');
    if (userInfo) {
        const passwordLink = document.createElement('div');
        passwordLink.className = 'password-change-link';
        passwordLink.innerHTML = `
            <a href="change-password.html"><i class="fas fa-key"></i> Zmień hasło</a>
        `;
        userInfo.appendChild(passwordLink);
    }
}

// Dodaj link do panelu administracyjnego dla administratorów
function addAdminPanelLink() {
    const userInfo = document.querySelector('.user-info');
    if (userInfo) {
        const adminLink = document.createElement('a');
        adminLink.href = 'admin.html';
        adminLink.innerHTML = '<i class="fas fa-user-cog"></i> Panel administracyjny';
        adminLink.className = 'btn-admin';
        adminLink.style.marginLeft = '10px';
        adminLink.style.padding = '8px 15px';
        adminLink.style.fontSize = '14px';
        userInfo.appendChild(adminLink);
    }
}

// Dodaj link do zarządzania rezerwacjami dla administratorów
function addReservationsManagementLink() {
    const userInfo = document.querySelector('.user-info');
    if (userInfo) {
        const reservationsLink = document.createElement('a');
        reservationsLink.href = 'reservations-management.html';
        reservationsLink.innerHTML = '<i class="fas fa-calendar-alt"></i> Zarządzaj rezerwacjami';
        reservationsLink.className = 'btn-admin';
        reservationsLink.style.marginLeft = '10px';
        reservationsLink.style.padding = '8px 15px';
        reservationsLink.style.fontSize = '14px';
        reservationsLink.style.backgroundColor = '#9b59b6';
        userInfo.appendChild(reservationsLink);
    }
}

// Inicjalizacja kalendarza - POPRAWIONA WERSJA
function initCalendar() {
    flatpickrInstance = flatpickr("#reservationDates", {
        mode: "range",
        dateFormat: "Y-m-d",
        locale: "pl",
        minDate: "today",
        maxDate: new Date().fp_incr(90), // 90 dni do przodu
        disableMobile: true,
        allowInput: false,
        clickOpens: true,
        onChange: function(selectedDates, dateStr, instance) {
            if (selectedDates.length === 2) {
                const startDate = selectedDates[0];
                const endDate = selectedDates[1];
                const diffTime = Math.abs(endDate - startDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                
                if (diffDays > 7) {
                    showMessage('message', 'Możesz zarezerwować auto maksymalnie na 7 dni', 'error');
                    instance.clear();
                    return;
                }
                
                // Upewnij się, że daty są ustawione poprawnie
                console.log('Wybrane daty:', startDate.toISOString().split('T')[0], 'do', endDate.toISOString().split('T')[0]);
            }
        },
        onReady: function(selectedDates, dateStr, instance) {
            // Dodaj obsługę manualnego wprowadzania dat
            const input = instance.input;
            input.addEventListener('blur', function() {
                const value = this.value;
                if (value) {
                    const dates = value.split(' do ');
                    if (dates.length === 2) {
                        const startDate = instance.parseDate(dates[0], 'Y-m-d');
                        const endDate = instance.parseDate(dates[1], 'Y-m-d');
                        if (startDate && endDate) {
                            instance.setDate([startDate, endDate], true);
                        }
                    }
                }
            });
        }
    });
}

// Aktualizacja dostępności w kalendarzu
function updateCalendarAvailability() {
    if (!selectedCar || !flatpickrInstance) return;
    
    // Pobierz rezerwacje dla wybranego auta
    const carReservations = reservations.filter(r => r.carId === selectedCar && r.id !== editingReservationId);
    
    // Utwórz tablicę z zajętymi datami
    const disabledDates = [];
    
    carReservations.forEach(reservation => {
        const startDate = new Date(reservation.startDate);
        const endDate = new Date(reservation.endDate);
        
        // Dodaj wszystkie daty z zakresu rezerwacji jako niedostępne
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            disabledDates.push(new Date(currentDate));
            currentDate.setDate(currentDate.getDate() + 1);
        }
    });
    
    // Zaktualizuj kalendarz
    flatpickrInstance.set('disable', disabledDates);
}

// Ładowanie rezerwacji
function loadReservations() {
    // Sprawdź czy istnieją zapisane rezerwacje w localStorage
    const savedReservations = localStorage.getItem('carReservations');
    
    if (savedReservations) {
        reservations = JSON.parse(savedReservations);
    } else {
        // Użyj domyślnych rezerwacji
        reservations = [
            {
                id: generateReservationId(),
                carId: "Auto1",
                carName: "Toyota Corolla",
                employeeName: "Jan Kowalski",
                department: "IT",
                startDate: getDateString(5), // 5 dni od teraz
                endDate: getDateString(7),   // 7 dni od teraz
                purpose: "Wyjazd służbowy do klienta",
                bookingDate: getDateString(0),
                login: "pracownik1"
            },
            {
                id: generateReservationId(),
                carId: "Auto3",
                carName: "Skoda Octavia",
                employeeName: "Anna Nowak",
                department: "Marketing",
                startDate: getDateString(10), // 10 dni od teraz
                endDate: getDateString(12),   // 12 dni od teraz
                purpose: "Targi branżowe",
                bookingDate: getDateString(0),
                login: "pracownik2"
            }
        ];
        saveReservationsToStorage();
    }
    
    updateCarAvailabilityDisplay();
    updateUserReservationsDisplay();
}

// Zapisz rezerwacje do localStorage
function saveReservationsToStorage() {
    localStorage.setItem('carReservations', JSON.stringify(reservations));
}

// Pomocnicza funkcja do generowania dat
function getDateString(daysFromNow) {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date.toISOString().split('T')[0];
}

// Wyświetlanie dostępności aut
function updateCarAvailabilityDisplay() {
    const container = document.getElementById('carAvailability');
    container.innerHTML = '';
    
    CARS.forEach(car => {
        const carElement = document.createElement('div');
        carElement.className = 'car-item';
        
        // Sprawdź czy auto jest zarezerwowane w najbliższych dniach
        const today = new Date();
        const carReservations = reservations.filter(r => r.carId === car.id);
        const upcomingReservations = carReservations.filter(r => new Date(r.endDate) >= today);
        
        if (upcomingReservations.length > 0) {
            // Auto jest zajęte
            carElement.classList.add('unavailable');
            
            // Znajdź najbliższą rezerwację
            const sortedReservations = upcomingReservations.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
            const nextReservation = sortedReservations[0];
            
            carElement.innerHTML = `
                <h5>${car.name} (${car.plate})</h5>
                <div class="car-dates">
                    <i class="fas fa-calendar-times"></i> Zajęte: ${formatDate(nextReservation.startDate)} - ${formatDate(nextReservation.endDate)}
                </div>
                <div class="car-purpose">
                    <i class="fas fa-user"></i> ${nextReservation.employeeName}
                </div>
            `;
        } else {
            // Auto jest dostępne
            carElement.classList.add('available');
            carElement.innerHTML = `
                <h5>${car.name} (${car.plate})</h5>
                <div class="car-dates">
                    <i class="fas fa-calendar-check"></i> Dostępne
                </div>
            `;
        }
        
        container.appendChild(carElement);
    });
}

// Wyświetlanie rezerwacji użytkownika
function updateUserReservationsDisplay() {
    const user = getCurrentUser();
    if (!user) return;
    
    const container = document.getElementById('userReservations');
    container.innerHTML = '';
    
    const userReservations = reservations.filter(r => r.login === user.login);
    
    if (userReservations.length === 0) {
        container.innerHTML = '<p>Nie masz żadnych rezerwacji.</p>';
        return;
    }
    
    userReservations.forEach(reservation => {
        const car = CARS.find(c => c.id === reservation.carId);
        const reservationElement = document.createElement('div');
        reservationElement.className = 'reservation-item';
        
        let actionsHtml = '';
        if (user.role === 'admin' || user.login === 'admin') {
            actionsHtml = `
                <div class="reservation-actions">
                    <button class="btn-edit-small" onclick="editUserReservation('${reservation.id}')">
                        <i class="fas fa-edit"></i> Edytuj
                    </button>
                    <button class="btn-delete-small" onclick="deleteUserReservation('${reservation.id}')">
                        <i class="fas fa-trash"></i> Usuń
                    </button>
                </div>
            `;
        }
        
        reservationElement.innerHTML = `
            <h5>${car ? car.name : reservation.carId}</h5>
            <div class="reservation-dates">
                <i class="fas fa-calendar"></i> ${formatDate(reservation.startDate)} - ${formatDate(reservation.endDate)}
            </div>
            <div class="reservation-purpose">
                <i class="fas fa-clipboard-list"></i> ${reservation.purpose}
            </div>
            ${actionsHtml}
        `;
        
        container.appendChild(reservationElement);
    });
}

// Edycja rezerwacji użytkownika (dla admina)
function editUserReservation(reservationId) {
    const reservation = reservations.find(r => r.id === reservationId);
    if (!reservation) return;
    
    // Wypełnij formularz danymi rezerwacji
    document.getElementById('employeeName').value = reservation.employeeName;
    document.getElementById('employeeDepartment').value = reservation.department;
    document.getElementById('carSelect').value = reservation.carId;
    document.getElementById('purpose').value = reservation.purpose;
    
    // Ustaw wybrane auto
    selectedCar = reservation.carId;
    document.getElementById('calendarSection').classList.remove('hidden');
    
    // Ustaw daty w kalendarzu
    const startDate = new Date(reservation.startDate);
    const endDate = new Date(reservation.endDate);
    
    // Ustawienie dat w flatpickr
    flatpickrInstance.setDate([startDate, endDate], true);
    
    // Ustaw tryb edycji
    editingReservationId = reservationId;
    
    // Zmień tekst przycisku
    const submitBtn = document.querySelector('.btn-submit');
    submitBtn.innerHTML = '<i class="fas fa-save"></i> Zaktualizuj rezerwację';
    
    // Zaktualizuj dostępność kalendarza
    updateCalendarAvailability();
    
    // Przewiń do formularza
    document.querySelector('.form-section').scrollIntoView({ behavior: 'smooth' });
    
    showMessage('message', 'Edytujesz rezerwację. Możesz zmienić dane i zapisać zmiany.', 'info');
}

// Usuwanie rezerwacji użytkownika (dla admina)
function deleteUserReservation(reservationId) {
    if (!confirm('Czy na pewno chcesz usunąć tę rezerwację?')) return;
    
    const user = getCurrentUser();
    if (!user || (user.role !== 'admin' && user.login !== 'admin')) {
        showMessage('message', 'Brak uprawnień do usuwania rezerwacji', 'error');
        return;
    }
    
    const index = reservations.findIndex(r => r.id === reservationId);
    if (index !== -1) {
        reservations.splice(index, 1);
        saveReservationsToStorage();
        
        updateCarAvailabilityDisplay();
        updateUserReservationsDisplay();
        
        if (selectedCar) {
            updateCalendarAvailability();
        }
        
        showMessage('message', 'Rezerwacja została usunięta', 'success');
    }
}

// Formatowanie daty
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('pl-PL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

// Zatwierdzanie rezerwacji
function submitReservation() {
    const user = getCurrentUser();
    if (!user) return;
    
    const selectedDates = flatpickrInstance.selectedDates;
    
    if (!selectedCar) {
        showMessage('message', 'Wybierz auto', 'error');
        return;
    }
    
    if (selectedDates.length !== 2) {
        showMessage('message', 'Wybierz zakres dat (od i do)', 'error');
        return;
    }
    
    const startDate = selectedDates[0];
    const endDate = selectedDates[1];
    const diffTime = Math.abs(endDate - startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    
    if (diffDays < 1 || diffDays > 7) {
        showMessage('message', 'Możesz zarezerwować auto na okres od 1 do 7 dni', 'error');
        return;
    }
    
    // Sprawdź czy auto jest dostępne w wybranym okresie (pomiń bieżącą rezerwację jeśli edytujemy)
    const carReservations = reservations.filter(r => r.carId === selectedCar && r.id !== editingReservationId);
    const isAvailable = carReservations.every(reservation => {
        const resStart = new Date(reservation.startDate);
        const resEnd = new Date(reservation.endDate);
        
        // Sprawdź czy zakresy się nie nakładają
        return (endDate < resStart) || (startDate > resEnd);
    });
    
    if (!isAvailable) {
        showMessage('message', 'Auto jest już zarezerwowane w wybranym okresie', 'error');
        return;
    }
    
    // Przygotuj dane rezerwacji
    const reservationData = {
        id: editingReservationId || generateReservationId(),
        carId: selectedCar,
        carName: CARS.find(c => c.id === selectedCar).name,
        employeeName: document.getElementById('employeeName').value,
        department: document.getElementById('employeeDepartment').value,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        purpose: document.getElementById('purpose').value,
        bookingDate: new Date().toISOString().split('T')[0],
        login: editingReservationId ? reservations.find(r => r.id === editingReservationId)?.login : user.login
    };
    
    if (editingReservationId) {
        // Aktualizuj istniejącą rezerwację
        const index = reservations.findIndex(r => r.id === editingReservationId);
        if (index !== -1) {
            reservations[index] = reservationData;
        }
    } else {
        // Dodaj nową rezerwację
        reservations.push(reservationData);
    }
    
    saveReservationsToStorage();
    
    showMessage('message', editingReservationId ? 'Rezerwacja została zaktualizowana!' : 'Rezerwacja została zapisana!', 'success');
    
    // Zresetuj formularz
    resetReservationForm();
    
    // Odśwież wyświetlane dane
    updateCarAvailabilityDisplay();
    updateUserReservationsDisplay();
    updateCalendarAvailability();
    
    // Aktualizuj datę ostatniej aktualizacji
    document.getElementById('lastUpdate').textContent = 
        `Ostatnia aktualizacja: ${new Date().toLocaleString('pl-PL')}`;
}

// Resetowanie formularza rezerwacji
function resetReservationForm() {
    document.getElementById('reservationForm').reset();
    document.getElementById('employeeName').value = currentUser.name;
    document.getElementById('calendarSection').classList.add('hidden');
    document.getElementById('carSelect').value = '';
    selectedCar = null;
    flatpickrInstance.clear();
    editingReservationId = null;
    
    // Przywróć domyślny tekst przycisku
    const submitBtn = document.querySelector('.btn-submit');
    submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Zatwierdź rezerwację';
}

// Ładowanie danych z Google Sheets
function loadDataFromGoogleSheets() {
    // Symulacja aktualizacji danych co 30 sekund
    setInterval(() => {
        document.getElementById('lastUpdate').textContent = 
            `Ostatnia aktualizacja: ${new Date().toLocaleString('pl-PL')}`;
    }, 30000);
}
