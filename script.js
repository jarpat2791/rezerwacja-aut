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

// Inicjalizacja kalendarza
function initCalendar() {
    flatpickrInstance = flatpickr("#reservationDates", {
        mode: "range",
        dateFormat: "Y-m-d",
        locale: "pl",
        minDate: "today",
        maxDate: new Date().fp_incr(90), // 90 dni do przodu
        disableMobile: true,
        onChange: function(selectedDates, dateStr, instance) {
            if (selectedDates.length === 2) {
                const startDate = selectedDates[0];
                const endDate = selectedDates[1];
                const diffTime = Math.abs(endDate - startDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                
                if (diffDays > 7) {
                    showMessage('message', 'Możesz zarezerwować auto maksymalnie na 7 dni', 'error');
                    instance.clear();
                }
            }
        }
    });
}

// Aktualizacja dostępności w kalendarzu
function updateCalendarAvailability() {
    if (!selectedCar || !flatpickrInstance) return;
    
    // Pobierz rezerwacje dla wybranego auta
    const carReservations = reservations.filter(r => r.carId === selectedCar);
    
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
    // W rzeczywistości pobieranie z Google Sheets przez Google Apps Script
    // Tutaj symulujemy dane
    reservations = [
        {
            carId: "Auto1",
            carName: "Toyota Corolla",
            employeeName: "Jan Kowalski",
            department: "IT",
            startDate: "2023-10-15",
            endDate: "2023-10-17",
            purpose: "Wyjazd służbowy do klienta"
        },
        {
            carId: "Auto3",
            carName: "Skoda Octavia",
            employeeName: "Anna Nowak",
            department: "Marketing",
            startDate: "2023-10-20",
            endDate: "2023-10-22",
            purpose: "Targi branżowe"
        }
    ];
    
    updateCarAvailabilityDisplay();
    updateUserReservationsDisplay();
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
    
    const userReservations = reservations.filter(r => r.employeeName === user.name);
    
    if (userReservations.length === 0) {
        container.innerHTML = '<p>Nie masz żadnych rezerwacji.</p>';
        return;
    }
    
    userReservations.forEach(reservation => {
        const car = CARS.find(c => c.id === reservation.carId);
        const reservationElement = document.createElement('div');
        reservationElement.className = 'reservation-item';
        
        reservationElement.innerHTML = `
            <h5>${car ? car.name : reservation.carId}</h5>
            <div class="reservation-dates">
                <i class="fas fa-calendar"></i> ${formatDate(reservation.startDate)} - ${formatDate(reservation.endDate)}
            </div>
            <div class="reservation-purpose">
                <i class="fas fa-clipboard-list"></i> ${reservation.purpose}
            </div>
        `;
        
        container.appendChild(reservationElement);
    });
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
    
    // Sprawdź czy auto jest dostępne w wybranym okresie
    const carReservations = reservations.filter(r => r.carId === selectedCar);
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
        carId: selectedCar,
        carName: CARS.find(c => c.id === selectedCar).name,
        employeeName: document.getElementById('employeeName').value,
        department: document.getElementById('employeeDepartment').value,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        purpose: document.getElementById('purpose').value,
        bookingDate: new Date().toISOString().split('T')[0],
        login: user.login
    };
    
    // Wysłanie danych do Google Sheets (symulacja)
    sendReservationToGoogleSheets(reservationData);
}

// Wysyłanie rezerwacji do Google Sheets
function sendReservationToGoogleSheets(reservationData) {
    // Symulacja pomyślnego zapisu
    setTimeout(() => {
        showMessage('message', 'Rezerwacja została zapisana!', 'success');
        
        // Dodaj rezerwację do lokalnej listy
        reservations.push(reservationData);
        updateCarAvailabilityDisplay();
        updateUserReservationsDisplay();
        updateCalendarAvailability();
        
        // Wyczyść formularz
        document.getElementById('reservationForm').reset();
        document.getElementById('employeeName').value = currentUser.name;
        document.getElementById('calendarSection').classList.add('hidden');
        document.getElementById('carSelect').value = '';
        selectedCar = null;
        flatpickrInstance.clear();
        
        // Aktualizuj datę ostatniej aktualizacji
        document.getElementById('lastUpdate').textContent = 
            `Ostatnia aktualizacja: ${new Date().toLocaleString('pl-PL')}`;
    }, 1000);
}

// Ładowanie danych z Google Sheets
function loadDataFromGoogleSheets() {
    // Symulacja aktualizacji danych co 30 sekund
    setInterval(() => {
        document.getElementById('lastUpdate').textContent = 
            `Ostatnia aktualizacja: ${new Date().toLocaleString('pl-PL')}`;
    }, 30000);
}