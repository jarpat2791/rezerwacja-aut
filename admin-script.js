// Skrypt dla panelu administracyjnego zarządzania użytkownikami

let users = [];
let editingUserId = null;

document.addEventListener('DOMContentLoaded', function() {
    // Sprawdź czy użytkownik jest zalogowany i ma uprawnienia admina
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.login !== 'admin')) {
        alert('Brak uprawnień do panelu administracyjnego!');
        window.location.href = 'index.html';
        return;
    }
    
    // Ustaw nazwę administratora
    document.getElementById('userDisplay').textContent = `Zalogowany jako: ${currentUser.name}`;
    
    // Załaduj użytkowników
    loadUsers();
    
    // Obsługa przycisków
    document.getElementById('addUserBtn').addEventListener('click', function() {
        showUserForm();
    });
    
    document.getElementById('exportUsersBtn').addEventListener('click', function() {
        exportUsers();
    });
    
    // Obsługa formularza użytkownika
    document.getElementById('userForm').addEventListener('submit', function(e) {
        e.preventDefault();
        saveUser();
    });
    
    // Obsługa zamknięcia modala
    document.querySelectorAll('.close-modal').forEach(button => {
        button.addEventListener('click', function() {
            document.getElementById('userFormModal').classList.add('hidden');
            resetUserForm();
        });
    });
    
    // Obsługa siły hasła
    document.getElementById('editPassword').addEventListener('input', function() {
        checkPasswordStrength(this.value);
    });
});

// Załaduj użytkowników
function loadUsers() {
    // Sprawdź czy istnieją zapisani użytkownicy w localStorage
    const savedUsers = localStorage.getItem('systemUsers');
    
    if (savedUsers) {
        users = JSON.parse(savedUsers);
    } else {
        // Użyj domyślnych użytkowników z script.js
        // Importujemy VALID_USERS z głównego skryptu
        if (typeof VALID_USERS !== 'undefined') {
            users = JSON.parse(JSON.stringify(VALID_USERS));
        } else {
            // Fallback jeśli VALID_USERS nie jest dostępny
            users = [
                { login: "pracownik1", password: "haslo123", name: "Jan Kowalski", role: "user" },
                { login: "pracownik2", password: "haslo456", name: "Anna Nowak", role: "user" },
                { login: "pracownik3", password: "haslo789", name: "Piotr Wiśniewski", role: "user" },
                { login: "admin", password: "admin123", name: "Administrator", role: "admin" }
            ];
        }
        saveUsersToStorage();
    }
    
    renderUsersTable();
}

// Zapisz użytkowników do localStorage
function saveUsersToStorage() {
    localStorage.setItem('systemUsers', JSON.stringify(users));
}

// Wyświetl użytkowników w tabeli
function renderUsersTable() {
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = '';
    
    users.forEach((user, index) => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>${user.login}</td>
            <td>${'*'.repeat(user.password.length)}</td>
            <td>${user.name}</td>
            <td>${user.role === 'admin' ? 'Administrator' : 'Pracownik'}</td>
            <td>
                <button class="btn-edit" onclick="editUser(${index})">
                    <i class="fas fa-edit"></i> Edytuj
                </button>
                <button class="btn-change-password" onclick="changeUserPassword(${index})">
                    <i class="fas fa-key"></i> Zmień hasło
                </button>
                <button class="btn-delete" onclick="deleteUser(${index})">
                    <i class="fas fa-trash"></i> Usuń
                </button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

// Pokaż formularz użytkownika
function showUserForm(user = null) {
    const modal = document.getElementById('userFormModal');
    const title = document.getElementById('modalTitle');
    
    if (user) {
        title.textContent = 'Edytuj użytkownika';
        document.getElementById('editLogin').value = user.login;
        document.getElementById('editPassword').value = user.password;
        document.getElementById('editName').value = user.name;
        document.getElementById('editRole').value = user.role || 'user';
        editingUserId = index;
    } else {
        title.textContent = 'Dodaj nowego użytkownika';
        editingUserId = null;
    }
    
    modal.classList.remove('hidden');
}

// Zapisz użytkownika
function saveUser() {
    const login = document.getElementById('editLogin').value;
    const password = document.getElementById('editPassword').value;
    const name = document.getElementById('editName').value;
    const role = document.getElementById('editRole').value;
    
    // Sprawdź czy login już istnieje (tylko przy dodawaniu nowego)
    if (editingUserId === null && users.some(u => u.login === login)) {
        alert('Użytkownik o tym loginie już istnieje!');
        return;
    }
    
    const userData = {
        login: login,
        password: password,
        name: name,
        role: role
    };
    
    if (editingUserId !== null) {
        // Edytuj istniejącego użytkownika
        users[editingUserId] = userData;
    } else {
        // Dodaj nowego użytkownika
        users.push(userData);
    }
    
    saveUsersToStorage();
    renderUsersTable();
    
    // Zamknij modal i zresetuj formularz
    document.getElementById('userFormModal').classList.add('hidden');
    resetUserForm();
    
    alert('Użytkownik został zapisany pomyślnie!');
}

// Zresetuj formularz użytkownika
function resetUserForm() {
    document.getElementById('userForm').reset();
    document.getElementById('passwordStrength').textContent = '-';
    editingUserId = null;
}

// Edytuj użytkownika
function editUser(index) {
    showUserForm(users[index]);
}

// Zmień hasło użytkownika
function changeUserPassword(index) {
    const newPassword = prompt('Wprowadź nowe hasło dla użytkownika ' + users[index].name + ':');
    
    if (newPassword && newPassword.length >= 8) {
        users[index].password = newPassword;
        saveUsersToStorage();
        renderUsersTable();
        alert('Hasło zostało zmienione pomyślnie!');
    } else if (newPassword) {
        alert('Hasło musi mieć minimum 8 znaków!');
    }
}

// Usuń użytkownika
function deleteUser(index) {
    if (confirm('Czy na pewno chcesz usunąć użytkownika ' + users[index].name + '?')) {
        users.splice(index, 1);
        saveUsersToStorage();
        renderUsersTable();
        alert('Użytkownik został usunięty!');
    }
}

// Eksportuj listę użytkowników
function exportUsers() {
    const dataStr = JSON.stringify(users, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = 'uzytkownicy_system_rezerwacji.json';
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
}

// Sprawdź siłę hasła
function checkPasswordStrength(password) {
    let strength = 0;
    const requirements = {
        length: false,
        uppercase: false,
        lowercase: false,
        number: false,
        special: false
    };
    
    // Długość
    if (password.length >= 8) {
        strength += 1;
        requirements.length = true;
    }
    
    // Wielkie litery
    if (/[A-Z]/.test(password)) {
        strength += 1;
        requirements.uppercase = true;
    }
    
    // Małe litery
    if (/[a-z]/.test(password)) {
        strength += 1;
        requirements.lowercase = true;
    }
    
    // Cyfry
    if (/[0-9]/.test(password)) {
        strength += 1;
        requirements.number = true;
    }
    
    // Znaki specjalne
    if (/[^A-Za-z0-9]/.test(password)) {
        strength += 1;
        requirements.special = true;
    }
    
    // Określ siłę hasła
    let strengthText = '';
    let strengthColor = '';
    
    switch(strength) {
        case 0:
        case 1:
            strengthText = 'Bardzo słabe';
            strengthColor = '#e74c3c';
            break;
        case 2:
            strengthText = 'Słabe';
            strengthColor = '#e67e22';
            break;
        case 3:
            strengthText = 'Średnie';
            strengthColor = '#f1c40f';
            break;
        case 4:
            strengthText = 'Silne';
            strengthColor = '#2ecc71';
            break;
        case 5:
            strengthText = 'Bardzo silne';
            strengthColor = '#27ae60';
            break;
    }
    
    document.getElementById('passwordStrength').textContent = strengthText;
    document.getElementById('passwordStrength').style.color = strengthColor;
}