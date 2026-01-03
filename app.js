// Configuração Firebase
const firebaseConfig = {
    apiKey: "AIzaSyDj1sXtBjPR1bHi-5bocY6hivgPriIaZxY",
    authDomain: "racha-facil-angoti.firebaseapp.com",
    projectId: "racha-facil-angoti",
    storageBucket: "racha-facil-angoti.firebasestorage.app",
    messagingSenderId: "117782293926",
    appId: "1:117782293926:web:9fccaf880bfea0561c7367"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// CRÍTICO: Configurar persistência LOCAL para manter login após redirect
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .then(() => {
        console.log('Persistência LOCAL ativada');
    })
    .catch((error) => {
        console.error('Erro ao configurar persistência:', error);
    });

// Estado global
let currentUser = null;
let allUsers = [];
let allExpenses = [];
let editingExpenseId = null;
let currentPhotoBase64 = null;
let currentSortBy = 'date'; // 'date' ou 'value'

// Elementos DOM - buscar quando o script rodar (HTML já carregou pois script está no final)
const loginScreen = document.getElementById('loginScreen');
const mainScreen = document.getElementById('mainScreen');
const loginButton = document.getElementById('loginButton');
const logoutButton = document.getElementById('logoutButton');
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');
const addExpenseButton = document.getElementById('addExpenseButton');
const expenseModal = document.getElementById('expenseModal');
const settlementModal = document.getElementById('settlementModal');
const calculateButton = document.getElementById('calculateButton');

// Listeners para ordenação
document.querySelectorAll('.sort-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const sortBy = btn.dataset.sort;
        currentSortBy = sortBy;
        
        // Atualizar botões ativos
        document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Re-renderizar lista
        renderExpenses();
    });
});

// Auth state observer - detecta quando usuário loga/desloga
auth.onAuthStateChanged(async (user) => {
    if (user) {
        console.log('✅ Usuário logado:', user.displayName);
        currentUser = user;
        await saveUserToFirestore(user);
        showMainScreen();
        loadUsers();
        loadExpenses();
    } else {
        console.log('❌ Usuário deslogado');
        currentUser = null;
        showLoginScreen();
    }
});

// Verificar se voltou de um redirect
console.log('🔍 Verificando redirect result...');
console.log('URL atual:', window.location.href);
auth.getRedirectResult().then((result) => {
    console.log('getRedirectResult retornou:', result);
    if (result && result.user) {
        console.log('✅ Login redirect OK:', result.user.displayName);
    } else {
        console.log('⚠️ Redirect result vazio');
    }
}).catch((error) => {
    console.error('❌ Erro redirect:', error.code, error.message);
});

// Salvar usuário no Firestore (auto-cadastro)
async function saveUserToFirestore(user) {
    try {
        await db.collection('users').doc(user.uid).set({
            name: user.displayName,
            email: user.email,
            photoURL: user.photoURL,
            lastLogin: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    } catch (error) {
        console.error('Erro ao salvar usuário:', error);
    }
}

// Login
loginButton.addEventListener('click', async () => {
    console.log('🔐 Iniciando login...');
    const provider = new firebase.auth.GoogleAuthProvider();
    
    try {
        // Tentar popup primeiro (mais confiável no mobile moderno)
        console.log('Tentando popup...');
        const result = await auth.signInWithPopup(provider);
        console.log('✅ Login popup OK:', result.user.displayName);
    } catch (popupError) {
        console.log('⚠️ Popup falhou:', popupError.code);
        
        // Se popup falhar, usar redirect
        if (popupError.code === 'auth/popup-blocked' || 
            popupError.code === 'auth/popup-closed-by-user' ||
            popupError.code === 'auth/cancelled-popup-request') {
            
            console.log('🔄 Tentando redirect...');
            try {
                await auth.signInWithRedirect(provider);
                console.log('✅ Redirect iniciado');
            } catch (redirectError) {
                console.error('❌ Erro redirect:', redirectError);
                alert('Erro: ' + redirectError.message);
            }
        } else {
            console.error('❌ Erro login:', popupError);
            alert('Erro: ' + popupError.message);
        }
    }
});

// Logout
logoutButton.addEventListener('click', async () => {
    if (confirm('Deseja realmente sair?')) {
        await auth.signOut();
    }
});

// Navegação de telas
function showLoginScreen() {
    console.log('📱 Mostrando tela de login');
    loginScreen.classList.add('active');
    mainScreen.classList.remove('active');
}

function showMainScreen() {
    console.log('📱 Mostrando tela principal');
    console.log('loginScreen:', loginScreen);
    console.log('mainScreen:', mainScreen);
    loginScreen.classList.remove('active');
    mainScreen.classList.add('active');
    
    // Atualizar avatar do usuário
    if (currentUser && currentUser.photoURL) {
        document.getElementById('userAvatarImg').src = currentUser.photoURL;
    }
    
    console.log('✅ Tela principal deve estar visível agora');
}

// Tabs
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        tabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(tc => tc.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tabName + 'Tab').classList.add('active');
    });
});

// Carregar usuários
function loadUsers() {
    db.collection('users').orderBy('name').onSnapshot((snapshot) => {
        allUsers = [];
        snapshot.forEach((doc) => {
            allUsers.push({ id: doc.id, ...doc.data() });
        });
        renderParticipants();
        updatePaidBySelect();
        updateParticipantsCheckboxes();
    });
}

// Renderizar participantes
function renderParticipants() {
    const participantsList = document.getElementById('participantsList');
    const emptyParticipants = document.getElementById('emptyParticipants');

    if (allUsers.length === 0) {
        participantsList.innerHTML = '';
        emptyParticipants.style.display = 'block';
        return;
    }

    emptyParticipants.style.display = 'none';
    participantsList.innerHTML = allUsers.map(user => `
        <div class="participant-card">
            <img src="${user.photoURL || 'https://via.placeholder.com/50'}" alt="${user.name}" class="participant-photo">
            <div class="participant-info">
                <div class="participant-name">${user.name}</div>
                <div class="participant-email">${user.email}</div>
            </div>
        </div>
    `).join('');
}

// Atualizar select "Quem Pagou"
function updatePaidBySelect() {
    const paidBySelect = document.getElementById('paidBy');
    paidBySelect.innerHTML = '<option value="">Selecione...</option>' +
        allUsers.map(user => `
            <option value="${user.id}">${user.name}</option>
        `).join('');
}

// Atualizar checkboxes de participantes
function updateParticipantsCheckboxes() {
    const container = document.getElementById('participantsCheckboxes');
    container.innerHTML = allUsers.map(user => `
        <label class="checkbox-option">
            <input type="checkbox" value="${user.id}" class="participant-checkbox">
            <span>${user.name}</span>
        </label>
    `).join('');

    // Listener para atualizar valores customizados
    const checkboxes = document.querySelectorAll('.participant-checkbox');
    checkboxes.forEach(cb => {
        cb.addEventListener('change', updateCustomValuesInputs);
    });
}

// Modal de despesa
addExpenseButton.addEventListener('click', () => {
    editingExpenseId = null;
    document.getElementById('modalTitle').textContent = 'Nova Despesa';
    resetExpenseForm();
    
    // Preencher data e hora atual
    const now = new Date();
    document.getElementById('expenseDate').value = now.toISOString().split('T')[0];
    document.getElementById('expenseTime').value = now.toTimeString().slice(0, 5);
    
    openModal(expenseModal);
});

function resetExpenseForm() {
    document.getElementById('expenseDescription').value = '';
    document.getElementById('expenseDate').value = '';
    document.getElementById('expenseTime').value = '';
    document.getElementById('expenseValue').value = '';
    document.getElementById('paidBy').value = '';
    document.querySelectorAll('.participant-checkbox').forEach(cb => cb.checked = false);
    document.querySelector('input[name="divisionType"][value="equal"]').checked = true;
    document.getElementById('customValuesSection').style.display = 'none';
    document.getElementById('photoPreview').style.display = 'none';
    document.getElementById('previewImage').src = '';
    currentPhotoBase64 = null;
}

// Tipo de divisão
document.querySelectorAll('input[name="divisionType"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        const customSection = document.getElementById('customValuesSection');
        if (e.target.value === 'custom') {
            customSection.style.display = 'block';
            updateCustomValuesInputs();
        } else {
            customSection.style.display = 'none';
        }
    });
});

// Atualizar inputs de valores customizados
function updateCustomValuesInputs() {
    const selectedCheckboxes = Array.from(document.querySelectorAll('.participant-checkbox:checked'));
    const container = document.getElementById('customValuesInputs');
    const totalValue = parseFloat(document.getElementById('expenseValue').value) || 0;
    
    if (selectedCheckboxes.length === 0) {
        container.innerHTML = '<p class="text-muted">Selecione os participantes primeiro</p>';
        return;
    }

    const equalShare = totalValue / selectedCheckboxes.length;

    container.innerHTML = selectedCheckboxes.map(cb => {
        const user = allUsers.find(u => u.id === cb.value);
        return `
            <div class="custom-value-input">
                <label>${user.name}</label>
                <input type="number" 
                       step="0.01" 
                       placeholder="0,00" 
                       value="${equalShare.toFixed(2)}"
                       data-user-id="${user.id}"
                       class="custom-value">
            </div>
        `;
    }).join('');

    // Listener para validar soma
    document.querySelectorAll('.custom-value').forEach(input => {
        input.addEventListener('input', validateCustomSum);
    });
}

// Validar soma dos valores customizados
function validateCustomSum() {
    const totalValue = parseFloat(document.getElementById('expenseValue').value) || 0;
    const customInputs = document.querySelectorAll('.custom-value');
    let sum = 0;
    
    customInputs.forEach(input => {
        sum += parseFloat(input.value) || 0;
    });

    const warning = document.getElementById('sumWarning');
    const diff = Math.abs(sum - totalValue);
    
    if (diff > 0.01) {
        warning.style.display = 'block';
        warning.textContent = `⚠️ Soma: R$ ${sum.toFixed(2)} (diferença: R$ ${diff.toFixed(2)})`;
        return false;
    } else {
        warning.style.display = 'none';
        return true;
    }
}

// Foto e OCR
document.getElementById('takePhotoButton').addEventListener('click', () => {
    const input = document.getElementById('photoInput');
    input.setAttribute('capture', 'environment'); // Forçar câmera
    input.click();
});

document.getElementById('chooseFileButton').addEventListener('click', () => {
    const input = document.getElementById('photoInput');
    input.removeAttribute('capture'); // Permitir galeria
    input.click();
});

document.getElementById('photoInput').addEventListener('change', handlePhotoSelect);
document.getElementById('removePhotoButton').addEventListener('click', removePhoto);

async function handlePhotoSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Verificar tamanho do arquivo (limite: 1MB para evitar Firestore muito pesado)
    if (file.size > 1024 * 1024) {
        alert('Imagem muito grande! Por favor, escolha uma imagem menor que 1MB.');
        return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
        const base64Data = event.target.result;
        currentPhotoBase64 = base64Data; // Salvar base64
        
        const img = document.getElementById('previewImage');
        img.src = base64Data;
        document.getElementById('photoPreview').style.display = 'block';
        document.getElementById('takePhotoButton').style.display = 'none';

        // OCR
        await performOCR(base64Data);
    };
    reader.readAsDataURL(file);
}

function removePhoto() {
    document.getElementById('photoPreview').style.display = 'none';
    document.getElementById('takePhotoButton').style.display = 'block';
    document.getElementById('photoInput').value = '';
    currentPhotoBase64 = null;
}

async function performOCR(imageData) {
    const ocrLoading = document.getElementById('ocrLoading');
    ocrLoading.style.display = 'block';

    try {
        const result = await Tesseract.recognize(imageData, 'por', {
            logger: m => console.log(m)
        });

        const text = result.data.text;
        console.log('📄 Texto OCR:', text);
        
        // Extrair valor
        const value = extractValue(text);
        if (value) {
            document.getElementById('expenseValue').value = value.toFixed(2);
            updateCustomValuesInputs();
        }
        
        // Extrair data
        const date = extractDate(text);
        if (date) {
            document.getElementById('expenseDate').value = date;
            console.log('📅 Data extraída:', date);
        }
        
        // Extrair hora
        const time = extractTime(text);
        if (time) {
            document.getElementById('expenseTime').value = time;
            console.log('🕐 Hora extraída:', time);
        }
        
        // Extrair descrição (primeira linha significativa)
        const description = extractDescription(text);
        if (description) {
            document.getElementById('expenseDescription').value = description;
            console.log('📝 Descrição extraída:', description);
        }
        
    } catch (error) {
        console.error('Erro no OCR:', error);
    } finally {
        ocrLoading.style.display = 'none';
    }
}

function extractValue(text) {
    const patterns = [
        /total[:\s]*r?\$?\s*(\d+[.,]\d{2})/i,
        /valor[:\s]*r?\$?\s*(\d+[.,]\d{2})/i,
        /r?\$\s*(\d+[.,]\d{2})/i,
        /(\d+[.,]\d{2})/
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            return parseFloat(match[1].replace(',', '.'));
        }
    }
    return null;
}

function extractDate(text) {
    // Remover espaços extras e normalizar
    const cleanText = text.replace(/\s+/g, ' ');
    
    // Múltiplos formatos de data
    const patterns = [
        // DD/MM/YYYY ou DD-MM-YYYY ou DD.MM.YYYY
        /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/g,
        // DD/MM/YY ou DD-MM-YY
        /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})(?!\d)/g,
        // Formatos com texto: "Data: DD/MM/YYYY" ou "DATA DD/MM/YYYY"
        /data[:\s]+(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/gi,
        // Formato brasileiro escrito: "DD de JANEIRO de YYYY"
        /(\d{1,2})\s+de\s+(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+(\d{4})/gi
    ];

    const monthMap = {
        'janeiro': '01', 'fevereiro': '02', 'março': '03', 'abril': '04',
        'maio': '05', 'junho': '06', 'julho': '07', 'agosto': '08',
        'setembro': '09', 'outubro': '10', 'novembro': '11', 'dezembro': '12'
    };

    for (const pattern of patterns) {
        const matches = [...cleanText.matchAll(pattern)];
        
        for (const match of matches) {
            let day, month, year;
            
            // Formato com nome do mês
            if (match[0].toLowerCase().includes('de')) {
                day = match[1].padStart(2, '0');
                month = monthMap[match[2].toLowerCase()];
                year = match[3];
            } else {
                day = match[1].padStart(2, '0');
                month = match[2].padStart(2, '0');
                year = match[3];
            }
            
            // Se ano tem 2 dígitos, assumir 20XX
            if (year.length === 2) {
                const yearNum = parseInt(year);
                // Se >= 50, assumir 19XX, senão 20XX
                year = yearNum >= 50 ? '19' + year : '20' + year;
            }
            
            // Validar data
            const d = parseInt(day);
            const m = parseInt(month);
            const y = parseInt(year);
            
            // Validações mais rigorosas
            if (d < 1 || d > 31) continue;
            if (m < 1 || m > 12) continue;
            if (y < 2020 || y > 2030) continue;
            
            // Validar dia do mês
            const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
            if (d > daysInMonth[m - 1]) continue;
            
            // Data válida encontrada
            console.log(`✅ Data encontrada: ${day}/${month}/${year}`);
            return `${year}-${month}-${day}`;
        }
    }
    
    console.log('⚠️ Nenhuma data válida encontrada');
    return null;
}

function extractTime(text) {
    // Remover espaços extras
    const cleanText = text.replace(/\s+/g, ' ');
    
    // Múltiplos formatos de hora
    const patterns = [
        // Com palavra "hora" ou "horário"
        /(?:hora|horário|time)[:\s]*(\d{1,2})[:\.](\d{2})/gi,
        // Formato padrão HH:MM ou HH.MM
        /\b(\d{1,2})[:\.](\d{2})\b/g,
        // Com segundos HH:MM:SS
        /\b(\d{1,2})[:\.](\d{2})[:\.](\d{2})\b/g
    ];

    const validTimes = [];

    for (const pattern of patterns) {
        const matches = [...cleanText.matchAll(pattern)];
        
        for (const match of matches) {
            const hour = parseInt(match[1]);
            const minute = parseInt(match[2]);
            
            // Validar horário (00:00 a 23:59)
            if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
                const timeStr = `${match[1].padStart(2, '0')}:${match[2].padStart(2, '0')}`;
                
                // Evitar horários improváveis em notas fiscais (madrugada)
                // Priorizar horários entre 6h e 23h
                const priority = (hour >= 6 && hour <= 23) ? 1 : 0;
                
                validTimes.push({ time: timeStr, priority, hour });
            }
        }
    }

    if (validTimes.length === 0) {
        console.log('⚠️ Nenhuma hora válida encontrada');
        return null;
    }

    // Ordenar por prioridade (horários comerciais primeiro)
    validTimes.sort((a, b) => b.priority - a.priority);
    
    console.log(`✅ Hora encontrada: ${validTimes[0].time}`);
    return validTimes[0].time;
}

function extractDescription(text) {
    // Pegar linhas não vazias
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    // Padrões para ignorar (cabeçalhos comuns em notas fiscais)
    const ignorePatterns = [
        /^cnpj/i,
        /^cpf/i,
        /^nota\s*fiscal/i,
        /^cupom/i,
        /^recibo/i,
        /^nf[-\s]?e/i,
        /^danfe/i,
        /^\d+$/,  // Apenas números
        /^data:/i,
        /^hora:/i,
        /^valor/i,
        /^total/i,
        /^subtotal/i,
        /^desconto/i,
        /^quantidade/i,
        /^cod/i,
        /^item/i,
        /^\d+[\/\-\.]\d+[\/\-\.]\d+/,  // Datas
        /^\d+:\d+/,  // Horas
        /^r\$\s*\d/i,  // Valores
    ];
    
    // Procurar por padrões que indicam nome de estabelecimento
    const establishmentPatterns = [
        /^([A-ZÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝ][A-Za-zÀ-ÿ\s&\-]{2,40})\s*$/,  // Nome próprio
        /razão\s*social[:\s]*([A-Z][A-Za-zÀ-ÿ\s&\-]{3,50})/i,
        /nome\s*fantasia[:\s]*([A-Z][A-Za-zÀ-ÿ\s&\-]{3,50})/i,
    ];

    // Primeiro tentar encontrar nome de estabelecimento
    for (const line of lines.slice(0, 10)) {  // Primeiras 10 linhas
        for (const pattern of establishmentPatterns) {
            const match = line.match(pattern);
            if (match) {
                const name = (match[1] || match[0]).trim();
                if (name.length >= 3 && name.length <= 50) {
                    console.log(`✅ Estabelecimento encontrado: ${name}`);
                    return name;
                }
            }
        }
    }
    
    // Se não encontrou estabelecimento, pegar primeira linha válida
    for (const line of lines) {
        // Ignorar linhas muito curtas ou muito longas
        if (line.length < 3 || line.length > 50) continue;
        
        // Verificar se deve ignorar
        let shouldIgnore = false;
        for (const pattern of ignorePatterns) {
            if (pattern.test(line)) {
                shouldIgnore = true;
                break;
            }
        }
        
        if (!shouldIgnore) {
            console.log(`✅ Descrição encontrada: ${line}`);
            return line;
        }
    }
    
    console.log('⚠️ Nenhuma descrição válida encontrada');
    return null;
}

// Salvar despesa
document.getElementById('saveExpenseButton').addEventListener('click', saveExpense);

async function saveExpense() {
    const description = document.getElementById('expenseDescription').value.trim();
    const expenseDate = document.getElementById('expenseDate').value;
    const expenseTime = document.getElementById('expenseTime').value;
    const totalValue = parseFloat(document.getElementById('expenseValue').value);
    const paidBy = document.getElementById('paidBy').value;
    const selectedCheckboxes = Array.from(document.querySelectorAll('.participant-checkbox:checked'));
    const divisionType = document.querySelector('input[name="divisionType"]:checked').value;

    // Validações
    if (!description) {
        alert('Preencha a descrição');
        return;
    }
    if (!expenseDate) {
        alert('Informe a data');
        return;
    }
    if (!expenseTime) {
        alert('Informe o horário');
        return;
    }
    if (!totalValue || totalValue <= 0) {
        alert('Informe um valor válido');
        return;
    }
    if (!paidBy) {
        alert('Selecione quem pagou');
        return;
    }
    if (selectedCheckboxes.length === 0) {
        alert('Selecione pelo menos um participante');
        return;
    }

    // Calcular splits
    let splits = {};
    
    if (divisionType === 'equal') {
        const equalShare = totalValue / selectedCheckboxes.length;
        selectedCheckboxes.forEach(cb => {
            splits[cb.value] = parseFloat(equalShare.toFixed(2));
        });
    } else {
        // Validar soma
        if (!validateCustomSum()) {
            alert('A soma dos valores deve ser igual ao valor total');
            return;
        }
        
        const customInputs = document.querySelectorAll('.custom-value');
        customInputs.forEach(input => {
            const userId = input.dataset.userId;
            const value = parseFloat(input.value);
            splits[userId] = value;
        });
    }

    // Criar timestamp combinando data e hora
    const dateTimeString = `${expenseDate}T${expenseTime}:00`;
    const timestamp = new Date(dateTimeString);

    // Salvar no Firestore
    try {
        const expenseData = {
            description,
            date: expenseDate,
            time: expenseTime,
            timestamp: firebase.firestore.Timestamp.fromDate(timestamp),
            totalValue,
            paidBy,
            splits,
            imageBase64: currentPhotoBase64,
            createdBy: currentUser.uid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (editingExpenseId) {
            await db.collection('expenses').doc(editingExpenseId).update(expenseData);
        } else {
            await db.collection('expenses').add(expenseData);
        }

        closeModal(expenseModal);
        resetExpenseForm();
    } catch (error) {
        console.error('Erro ao salvar despesa:', error);
        alert('Erro ao salvar despesa. Tente novamente.');
    }
}

// Carregar despesas
function loadExpenses() {
    db.collection('expenses').orderBy('createdAt', 'desc').onSnapshot((snapshot) => {
        allExpenses = [];
        snapshot.forEach((doc) => {
            allExpenses.push({ id: doc.id, ...doc.data() });
        });
        renderExpenses();
    });
}

// Formatar data para exibição
function formatDate(dateString) {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
}

// Renderizar despesas
function renderExpenses() {
    const expensesList = document.getElementById('expensesList');
    const emptyExpenses = document.getElementById('emptyExpenses');

    if (allExpenses.length === 0) {
        expensesList.innerHTML = '';
        emptyExpenses.style.display = 'block';
        return;
    }

    // Ordenar despesas
    const sortedExpenses = [...allExpenses].sort((a, b) => {
        if (currentSortBy === 'value') {
            // Ordenar por valor (maior para menor)
            return b.totalValue - a.totalValue;
        } else {
            // Ordenar por data/hora (mais recente primeiro)
            const timeA = a.timestamp ? a.timestamp.toMillis() : a.createdAt?.toMillis() || 0;
            const timeB = b.timestamp ? b.timestamp.toMillis() : b.createdAt?.toMillis() || 0;
            return timeB - timeA;
        }
    });

    emptyExpenses.style.display = 'none';
    expensesList.innerHTML = sortedExpenses.map((expense, index) => {
        const payer = allUsers.find(u => u.id === expense.paidBy);
        const participantsCount = Object.keys(expense.splits).length;
        const expenseNumber = index + 1; // Numeração sequencial
        
        return `
            <div class="expense-card">
                <div class="expense-number">${expenseNumber}</div>
                ${expense.imageBase64 ? `
                    <img src="${expense.imageBase64}" alt="Recibo" class="expense-image">
                ` : ''}
                <div class="expense-content">
                    <div class="expense-header">
                        <div>
                            <h3>${expense.description}</h3>
                            ${expense.date && expense.time ? `
                                <div class="expense-datetime">
                                    <span class="material-icons">event</span>
                                    ${formatDate(expense.date)} às ${expense.time}
                                </div>
                            ` : ''}
                        </div>
                        <div class="expense-value">R$ ${expense.totalValue.toFixed(2)}</div>
                    </div>
                    <div class="expense-info">
                        <div class="expense-detail">
                            <span class="material-icons">account_circle</span>
                            Pago por ${payer ? payer.name : 'Desconhecido'}
                        </div>
                        <div class="expense-detail">
                            <span class="material-icons">people</span>
                            ${participantsCount} participante${participantsCount > 1 ? 's' : ''}
                        </div>
                    </div>
                    <div class="expense-splits">
                        ${Object.entries(expense.splits).map(([userId, value]) => {
                            const user = allUsers.find(u => u.id === userId);
                            return `
                                <div class="split-item">
                                    <span>${user ? user.name : 'Desconhecido'}</span>
                                    <span>R$ ${value.toFixed(2)}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
                <div class="expense-actions">
                    <button class="btn-icon-small" onclick="editExpense('${expense.id}')">
                        <span class="material-icons">edit</span>
                    </button>
                    <button class="btn-icon-small" onclick="deleteExpense('${expense.id}')">
                        <span class="material-icons">delete</span>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Editar despesa
function editExpense(expenseId) {
    const expense = allExpenses.find(e => e.id === expenseId);
    if (!expense) return;

    editingExpenseId = expenseId;
    document.getElementById('modalTitle').textContent = 'Editar Despesa';
    
    document.getElementById('expenseDescription').value = expense.description;
    document.getElementById('expenseDate').value = expense.date || '';
    document.getElementById('expenseTime').value = expense.time || '';
    document.getElementById('expenseValue').value = expense.totalValue;
    document.getElementById('paidBy').value = expense.paidBy;

    // Marcar participantes
    Object.keys(expense.splits).forEach(userId => {
        const checkbox = document.querySelector(`.participant-checkbox[value="${userId}"]`);
        if (checkbox) checkbox.checked = true;
    });

    // Verificar se é divisão customizada
    const values = Object.values(expense.splits);
    const isEqual = values.every(v => Math.abs(v - values[0]) < 0.01);
    
    if (isEqual) {
        document.querySelector('input[name="divisionType"][value="equal"]').checked = true;
    } else {
        document.querySelector('input[name="divisionType"][value="custom"]').checked = true;
        document.getElementById('customValuesSection').style.display = 'block';
        updateCustomValuesInputs();
        
        // Preencher valores customizados
        setTimeout(() => {
            Object.entries(expense.splits).forEach(([userId, value]) => {
                const input = document.querySelector(`.custom-value[data-user-id="${userId}"]`);
                if (input) input.value = value.toFixed(2);
            });
        }, 100);
    }

    if (expense.imageBase64) {
        currentPhotoBase64 = expense.imageBase64;
        document.getElementById('previewImage').src = expense.imageBase64;
        document.getElementById('photoPreview').style.display = 'block';
        document.getElementById('takePhotoButton').style.display = 'none';
    }

    openModal(expenseModal);
}

// Deletar despesa
async function deleteExpense(expenseId) {
    if (!confirm('Deseja realmente excluir esta despesa?')) return;

    try {
        await db.collection('expenses').doc(expenseId).delete();
    } catch (error) {
        console.error('Erro ao deletar despesa:', error);
        alert('Erro ao deletar despesa. Tente novamente.');
    }
}

// Calcular Acerto
calculateButton.addEventListener('click', calculateSettlement);

function calculateSettlement() {
    if (allExpenses.length === 0) {
        alert('Não há despesas para calcular');
        return;
    }

    // Calcular balanço de cada pessoa
    const balances = {};
    
    allUsers.forEach(user => {
        balances[user.id] = 0;
    });

    allExpenses.forEach(expense => {
        // Quem pagou recebe
        balances[expense.paidBy] += expense.totalValue;
        
        // Quem deve paga
        Object.entries(expense.splits).forEach(([userId, value]) => {
            balances[userId] -= value;
        });
    });

    // Separar credores e devedores
    const creditors = [];
    const debtors = [];

    Object.entries(balances).forEach(([userId, balance]) => {
        if (balance > 0.01) {
            creditors.push({ userId, amount: balance });
        } else if (balance < -0.01) {
            debtors.push({ userId, amount: -balance });
        }
    });

    // Algoritmo de otimização
    const transfers = optimizeTransfers(creditors, debtors);

    // Renderizar resultado
    renderSettlement(balances, transfers);
    openModal(settlementModal);
}

function optimizeTransfers(creditors, debtors) {
    const transfers = [];
    const creditorsQueue = [...creditors].sort((a, b) => b.amount - a.amount);
    const debtorsQueue = [...debtors].sort((a, b) => b.amount - a.amount);

    while (creditorsQueue.length > 0 && debtorsQueue.length > 0) {
        const creditor = creditorsQueue[0];
        const debtor = debtorsQueue[0];

        const transferAmount = Math.min(creditor.amount, debtor.amount);

        transfers.push({
            from: debtor.userId,
            to: creditor.userId,
            amount: transferAmount
        });

        creditor.amount -= transferAmount;
        debtor.amount -= transferAmount;

        if (creditor.amount < 0.01) creditorsQueue.shift();
        if (debtor.amount < 0.01) debtorsQueue.shift();
    }

    return transfers;
}

function renderSettlement(balances, transfers) {
    const summaryDiv = document.getElementById('settlementSummary');
    const transfersDiv = document.getElementById('settlementTransfers');
    const emptySettlement = document.getElementById('emptySettlement');

    // Resumo
    summaryDiv.innerHTML = `
        <h3>Resumo Individual</h3>
        <div class="balance-list">
            ${Object.entries(balances).map(([userId, balance]) => {
                const user = allUsers.find(u => u.id === userId);
                const absBalance = Math.abs(balance);
                const statusClass = balance > 0.01 ? 'positive' : balance < -0.01 ? 'negative' : 'neutral';
                const statusText = balance > 0.01 ? 'recebe' : balance < -0.01 ? 'deve' : 'acertado';
                
                return `
                    <div class="balance-item ${statusClass}">
                        <img src="${user.photoURL || 'https://via.placeholder.com/40'}" alt="${user.name}">
                        <div class="balance-info">
                            <div class="balance-name">${user.name}</div>
                            <div class="balance-status">${statusText} R$ ${absBalance.toFixed(2)}</div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;

    // Transferências
    if (transfers.length === 0) {
        transfersDiv.innerHTML = '';
        emptySettlement.style.display = 'block';
    } else {
        emptySettlement.style.display = 'none';
        transfersDiv.innerHTML = `
            <h3>Transferências Necessárias</h3>
            <div class="transfer-list">
                ${transfers.map(transfer => {
                    const from = allUsers.find(u => u.id === transfer.from);
                    const to = allUsers.find(u => u.id === transfer.to);
                    
                    return `
                        <div class="transfer-item">
                            <div class="transfer-from">
                                <img src="${from.photoURL || 'https://via.placeholder.com/40'}" alt="${from.name}">
                                <span>${from.name}</span>
                            </div>
                            <div class="transfer-arrow">
                                <span class="material-icons">arrow_forward</span>
                                <div class="transfer-amount">R$ ${transfer.amount.toFixed(2)}</div>
                            </div>
                            <div class="transfer-to">
                                <img src="${to.photoURL || 'https://via.placeholder.com/40'}" alt="${to.name}">
                                <span>${to.name}</span>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }
}

// Modal helpers
function openModal(modal) {
    modal.classList.add('active');
}

function closeModal(modal) {
    modal.classList.remove('active');
}

document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal');
        closeModal(modal);
    });
});

// Fechar modal clicando fora
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal(modal);
        }
    });
});

// Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
        .then(() => console.log('Service Worker registrado'))
        .catch(err => console.error('Erro ao registrar Service Worker:', err));
}
