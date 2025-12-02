// Skrypt dla zmiany hasła przez użytkownika

document.addEventListener('DOMContentLoaded', function() {
    // Sprawdź czy użytkownik jest zalogowany
    const user = getCurrentUser();
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    
    const newPasswordInput = document.getElementById('newPassword');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const submitBtn = document.getElementById('submitBtn');
    
    // Sprawdź siłę hasła
    newPasswordInput.addEventListener('input', function() {
        checkPasswordStrength(this.value);
        checkPasswordsMatch();
    });
    
    // Sprawdź czy hasła są identyczne
    confirmPasswordInput.addEventListener('input', checkPasswordsMatch);
    
    // Obsługa formularza
    document.getElementById('changePasswordForm').addEventListener('submit', function(e) {
        e.preventDefault();
        changePassword();
    });
});

// Sprawdź siłę hasła
function checkPasswordStrength(password) {
    let strength = 0;
    
    // Długość
    if (password.length >= 8) {
        strength += 1;
        document.getElementById('lengthReq').className = 'req-met';
    } else {
        document.getElementById('lengthReq').className = 'req-not-met';
    }
    
    // Wielkie litery
    if (/[A-Z]/.test(password)) {
        strength += 1;
        document.getElementById('uppercaseReq').className = 'req-met';
    } else {
        document.getElementById('uppercaseReq').className = 'req-not-met';
    }
    
    // Małe litery
    if (/[a-z]/.test(password)) {
        strength += 1;
        document.getElementById('lowercaseReq').className = 'req-met';
    } else {
        document.getElementById('lowercaseReq').className = 'req-not-met';
    }
    
    // Cyfry
    if (/[0-9]/.test(password)) {
        strength += 1;
        document.getElementById('numberReq').className = 'req-met';
    } else {
        document.getElementById('numberReq').className = 'req-not-met';
    }
    
    // Znaki specjalne
    if (/[^A-Za-z0-9]/.test(password)) {
        strength += 1;
        document.getElementById('specialReq').className = 'req-met';
    } else {
        document.getElementById('specialReq').className = 'req-not-met';
    }
    
    return strength >= 3; // Hasło jest akceptowalne jeśli ma co najmniej 3 punkty
}

// Sprawdź czy hasła są identyczne
function checkPasswordsMatch() {
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const matchDiv = document.getElementById('passwordMatch');
    const mismatchDiv = document.getElementById('passwordMismatch');
    const submitBtn = document.getElementById('submitBtn');
    
    if (newPassword === '' || confirmPassword === '') {
        matchDiv.classList.add('hidden');
        mismatchDiv.classList.add('hidden');
        submitBtn.disabled = true;
        return;
    }
    
    if (newPassword === confirmPassword) {
        matchDiv.classList.remove('hidden');
        mismatchDiv.classList.add('hidden');
        
        // Sprawdź czy hasło jest wystarczająco silne
        const isStrongEnough = checkPasswordStrength(newPassword);
        submitBtn.disabled = !isStrongEnough;
    } else {
        matchDiv.classList.add('hidden');
        mismatchDiv.classList.remove('hidden');
        submitBtn.disabled = true;
    }
}

// Zmień hasło
function changePassword() {
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const currentUser = getCurrentUser();
    
    if (!currentUser) {
        showMessage('changePasswordMessage', 'Nie jesteś zalogowany!', 'error');
        return;
    }
    
    // Sprawdź czy nowe hasła są identyczne
    if (newPassword !== confirmPassword) {
        showMessage('changePasswordMessage', 'Nowe hasła nie są identyczne!', 'error');
        return;
    }
    
    // Sprawdź siłę hasła
    if (!checkPasswordStrength(newPassword)) {
        showMessage('changePasswordMessage', 'Nowe hasło jest zbyt słabe! Spełnij wszystkie wymagania.', 'error');
        return;
    }
    
    // Pobierz aktualną listę użytkowników
    let users = [];
    const savedUsers = localStorage.getItem('systemUsers');
    
    if (savedUsers) {
        users = JSON.parse(savedUsers);
    } else {
        // Użyj domyślnej listy
        users = JSON.parse(JSON.stringify(VALID_USERS || [
            { login: "pracownik1", password: "haslo123", name: "Jan Kowalski", role: "user" },
            { login: "pracownik2", password: "haslo456", name: "Anna Nowak", role: "user" },
            { login: "pracownik3", password: "haslo789", name: "Piotr Wiśniewski", role: "user" },
            { login: "admin", password: "admin123", name: "Administrator", role: "admin" }
        ]));
    }
    
    // Znajdź użytkownika
    const userIndex = users.findIndex(u => u.login === currentUser.login);
    
    if (userIndex === -1) {
        showMessage('changePasswordMessage', 'Użytkownik nie został znaleziony!', 'error');
        return;
    }
    
    // Sprawdź aktualne hasło
    if (users[userIndex].password !== currentPassword) {
        showMessage('changePasswordMessage', 'Aktualne hasło jest nieprawidłowe!', 'error');
        return;
    }
    
    // Sprawdź czy nowe hasło jest różne od starego
    if (currentPassword === newPassword) {
        showMessage('changePasswordMessage', 'Nowe hasło musi być różne od aktualnego!', 'error');
        return;
    }
    
    // Zmień hasło
    users[userIndex].password = newPassword;
    
    // Zapisz zaktualizowaną listę użytkowników
    localStorage.setItem('systemUsers', JSON.stringify(users));
    
    // Zaktualizuj bieżącego użytkownika w localStorage
    currentUser.password = newPassword;
    setCurrentUser(currentUser);
    
    showMessage('changePasswordMessage', 'Hasło zostało pomyślnie zmienione!', 'success');
    
    // Wyczyść formularz
    document.getElementById('changePasswordForm').reset();
    document.getElementById('submitBtn').disabled = true;
    
    // Ukryj komunikaty o zgodności haseł
    document.getElementById('passwordMatch').classList.add('hidden');
    document.getElementById('passwordMismatch').classList.add('hidden');
    
    // Zresetuj wymagania hasła
    document.querySelectorAll('.password-requirements li').forEach(li => {
        li.className = 'req-not-met';
    });
    
    // Automatyczne przekierowanie po 3 sekundach
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 3000);
}

// Funkcje pomocnicze
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

function getCurrentUser() {
    const userData = localStorage.getItem('currentUser');
    return userData ? JSON.parse(userData) : null;
}

function setCurrentUser(user) {
    localStorage.setItem('currentUser', JSON.stringify(user));
}