// Configuração Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    deleteDoc,
    updateDoc,
    doc, 
    onSnapshot,
    enableIndexedDbPersistence 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
    getAuth,
    GoogleAuthProvider,
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDj1sXtBjPR1bHi-5bocY6hivgPriIaZxY",
  authDomain: "racha-facil-angoti.firebaseapp.com",
  projectId: "racha-facil-angoti",
  storageBucket: "racha-facil-angoti.firebasestorage.app",
  messagingSenderId: "117782293926",
  appId: "1:117782293926:web:9fccaf880bfea0561c7367"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Estado do usuário atual
let currentUser = null;

// Habilitar persistência offline
enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
        console.log('Persistência offline: múltiplas abas abertas');
    } else if (err.code === 'unimplemented') {
        console.log('Persistência offline não suportada neste navegador');
    }
});

// Estado da aplicação
let pessoas = [];
let despesas = [];
let unsubscribePessoas = null;
let unsubscribeDespesas = null;

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    inicializarAuth();
    inicializarEventos();
});

// Inicializar autenticação
function inicializarAuth() {
    console.log('=== INICIANDO AUTENTICACAO ===');
    console.log('Auth configurado:', !!auth);
    console.log('Provider configurado:', !!googleProvider);
    
    const btnGoogleLogin = document.getElementById('btnGoogleLogin');
    const btnLogout = document.getElementById('btnLogout');
    
    console.log('Botao login encontrado:', !!btnGoogleLogin);
    console.log('Botao logout encontrado:', !!btnLogout);
    
    // Verificar se voltou de um redirect (mobile)
    console.log('Verificando redirect result...');
    getRedirectResult(auth)
        .then((result) => {
            console.log('Redirect result recebido:', result);
            if (result) {
                currentUser = result.user;
                console.log('[OK] Login por redirect OK:', currentUser.displayName);
            } else {
                console.log('Nenhum redirect pendente');
            }
        })
        .catch((error) => {
            console.error('[ERRO] no redirect:', error);
            console.error('Codigo do erro:', error.code);
            console.error('Mensagem:', error.message);
            if (error.code === 'auth/unauthorized-domain') {
                alert('ERRO: Dominio nao autorizado no Firebase. Adicione angoti.github.io nos dominios autorizados.');
            }
        });
    
    // Listener de login
    if (btnGoogleLogin) {
        btnGoogleLogin.addEventListener('click', loginComGoogle);
        console.log('[OK] Click listener adicionado ao botao');
    } else {
        console.error('[ERRO] Botao nao encontrado!');
    }
    
    // Listener de logout
    if (btnLogout) {
        btnLogout.addEventListener('click', logout);
    }
    
    // Observar mudanças no estado de autenticação
    console.log('Configurando onAuthStateChanged...');
    onAuthStateChanged(auth, (user) => {
        console.log('=== AUTH STATE CHANGED ===');
        console.log('User object:', user);
        if (user) {
            // Usuário logado
            currentUser = user;
            console.log('[OK] USUARIO LOGADO');
            console.log('Nome:', user.displayName);
            console.log('Email:', user.email);
            mostrarApp();
            migrarDadosLocalStorage();
            inicializarListeners();
        } else {
            // Usuário deslogado
            currentUser = null;
            console.log('[INFO] USUARIO DESLOGADO');
            mostrarLogin();
            limparListeners();
        }
    });
}

// Login com Google
async function loginComGoogle() {
    console.log('');
    console.log('=== BOTAO CLICADO ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('User agent:', navigator.userAgent);
    
    const btnGoogleLogin = document.getElementById('btnGoogleLogin');
    
    try {
        // Desabilitar botão durante login
        btnGoogleLogin.disabled = true;
        btnGoogleLogin.textContent = 'Carregando...';
        console.log('Botao desabilitado');
        
        // Detectar se é mobile
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        console.log('E mobile?', isMobile);
        
        if (isMobile) {
            // Mobile: usar redirect (mais confiável, não é bloqueado)
            console.log('[REDIRECT] Iniciando signInWithRedirect...');
            console.log('Auth:', auth);
            console.log('Provider:', googleProvider);
            await signInWithRedirect(auth, googleProvider);
            console.log('Redirect chamado (pagina deve redirecionar agora)');
            // A página vai recarregar após o redirect
        } else {
            // Desktop: usar popup
            console.log('[POPUP] Iniciando signInWithPopup...');
            const result = await signInWithPopup(auth, googleProvider);
            currentUser = result.user;
            console.log('[OK] Login popup OK:', currentUser.displayName);
        }
    } catch (error) {
        console.error('');
        console.error('=== ERRO NO LOGIN ===');
        console.error('Error object completo:', error);
        console.error('Codigo:', error.code);
        console.error('Mensagem:', error.message);
        console.error('Stack:', error.stack);
        
        let mensagemErro = 'Erro ao fazer login. Tente novamente.';
        
        if (error.code === 'auth/popup-blocked') {
            console.log('Popup bloqueado, tentando redirect...');
            mensagemErro = 'Popup bloqueado! Tentando metodo alternativo...';
            // Tentar redirect como fallback
            try {
                await signInWithRedirect(auth, googleProvider);
                return; // Vai redirecionar, não precisa mostrar erro
            } catch (redirectError) {
                console.error('Erro no redirect tambem:', redirectError);
                mensagemErro = 'Nao foi possivel fazer login. Verifique suas configuracoes de privacidade.';
            }
        } else if (error.code === 'auth/popup-closed-by-user') {
            mensagemErro = 'Login cancelado.';
        } else if (error.code === 'auth/unauthorized-domain') {
            mensagemErro = 'ERRO CRITICO!\n\nDominio nao autorizado.\n\nSolucao:\n1. Acesse console.firebase.google.com\n2. Projeto: racha-facil-angoti\n3. Authentication > Settings\n4. Authorized domains > Add domain\n5. Digite: angoti.github.io';
        }
        
        alert(mensagemErro);
        
        // Reabilitar botão
        btnGoogleLogin.disabled = false;
        btnGoogleLogin.innerHTML = `
            <svg width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                <path fill="none" d="M0 0h48v48H0z"/>
            </svg>
            Entrar com Google
        `;
        console.log('Botao reabilitado');
    }
}

// Logout
async function logout() {
    if (!confirm('Deseja sair?')) return;
    
    try {
        await signOut(auth);
        console.log('Logout realizado');
    } catch (error) {
        console.error('Erro no logout:', error);
        alert('Erro ao sair. Tente novamente.');
    }
}

// Mostrar tela de login
function mostrarLogin() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('appContainer').style.display = 'none';
}

// Mostrar app
function mostrarApp() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('appContainer').style.display = 'block';
    
    // Atualizar foto do usuário
    if (currentUser && currentUser.photoURL) {
        document.getElementById('userPhoto').src = currentUser.photoURL;
    }
}

// Limpar listeners do Firebase
function limparListeners() {
    if (unsubscribePessoas) {
        unsubscribePessoas();
        unsubscribePessoas = null;
    }
    if (unsubscribeDespesas) {
        unsubscribeDespesas();
        unsubscribeDespesas = null;
    }
    pessoas = [];
    despesas = [];
}

// Migrar dados do localStorage para Firebase (apenas uma vez)
async function migrarDadosLocalStorage() {
    const migrado = localStorage.getItem('migrado_firebase');
    
    if (!migrado) {
        const pessoasLocal = localStorage.getItem('pessoas');
        const despesasLocal = localStorage.getItem('despesas');
        
        if (pessoasLocal) {
            const pessoasArray = JSON.parse(pessoasLocal);
            for (const pessoa of pessoasArray) {
                await addDoc(collection(db, 'pessoas'), pessoa);
            }
        }
        
        if (despesasLocal) {
            const despesasArray = JSON.parse(despesasLocal);
            for (const despesa of despesasArray) {
                await addDoc(collection(db, 'despesas'), despesa);
            }
        }
        
        localStorage.setItem('migrado_firebase', 'true');
        console.log('Dados migrados para Firebase com sucesso!');
    }
}

// Inicializar listeners em tempo real do Firebase
function inicializarListeners() {
    // Listener de pessoas
    unsubscribePessoas = onSnapshot(collection(db, 'pessoas'), (snapshot) => {
        pessoas = [];
        snapshot.forEach((doc) => {
            pessoas.push({
                firebaseId: doc.id,
                ...doc.data()
            });
        });
        atualizarInterface();
    });
    
    // Listener de despesas
    unsubscribeDespesas = onSnapshot(collection(db, 'despesas'), (snapshot) => {
        despesas = [];
        snapshot.forEach((doc) => {
            despesas.push({
                firebaseId: doc.id,
                ...doc.data()
            });
        });
        atualizarInterface();
    });
}

// Inicializar eventos
function inicializarEventos() {
    // Tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;
            mudarTab(targetTab);
        });
    });

    // Adicionar pessoa
    document.getElementById('btnAdicionarPessoa').addEventListener('click', adicionarPessoa);
    document.getElementById('inputNovaPessoa').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') adicionarPessoa();
    });

    // Modal despesa
    document.getElementById('btnNovaDespesa').addEventListener('click', abrirModalDespesa);
    document.getElementById('btnFecharModal').addEventListener('click', fecharModalDespesa);
    document.getElementById('btnCancelar').addEventListener('click', fecharModalDespesa);
    
    // Form despesa
    document.getElementById('formDespesa').addEventListener('submit', salvarDespesa);
    
    // Preview foto/arquivo
    document.getElementById('fotoRecibo').addEventListener('change', previewArquivo);
    document.getElementById('cameraRecibo').addEventListener('change', previewArquivo);
    
    // Botões de câmera e arquivo
    document.getElementById('btnCamera').addEventListener('click', () => {
        document.getElementById('cameraRecibo').click();
    });
    document.getElementById('btnArquivo').addEventListener('click', () => {
        document.getElementById('fotoRecibo').click();
    });
    
    // Fechar modal clicando fora
    document.getElementById('modalDespesa').addEventListener('click', (e) => {
        if (e.target.id === 'modalDespesa') fecharModalDespesa();
    });
}

// Mudar tab
function mudarTab(tabName) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(tabName).classList.add('active');
    
    atualizarInterface();
}

// Adicionar pessoa
async function adicionarPessoa() {
    const input = document.getElementById('inputNovaPessoa');
    const nome = input.value.trim();
    
    if (!nome) {
        alert('Digite um nome válido');
        return;
    }
    
    if (pessoas.find(p => p.nome.toLowerCase() === nome.toLowerCase())) {
        alert('Pessoa já cadastrada');
        return;
    }
    
    try {
        await addDoc(collection(db, 'pessoas'), {
            id: Date.now(),
            nome: nome
        });
        input.value = '';
    } catch (error) {
        console.error('Erro ao adicionar pessoa:', error);
        alert('Erro ao adicionar pessoa. Tente novamente.');
    }
}

// Remover pessoa
async function removerPessoa(firebaseId) {
    if (!confirm('Tem certeza que deseja remover esta pessoa?')) return;
    
    try {
        await deleteDoc(doc(db, 'pessoas', firebaseId));
    } catch (error) {
        console.error('Erro ao remover pessoa:', error);
        alert('Erro ao remover pessoa. Tente novamente.');
    }
}

// Abrir modal de despesa
function abrirModalDespesa() {
    if (pessoas.length === 0) {
        alert('Cadastre pelo menos uma pessoa primeiro');
        mudarTab('pessoas');
        return;
    }
    
    // Preencher select de pagador
    const selectPagador = document.getElementById('pagador');
    selectPagador.innerHTML = '<option value="">Selecione...</option>';
    pessoas.forEach(pessoa => {
        selectPagador.innerHTML += `<option value="${pessoa.id}">${pessoa.nome}</option>`;
    });
    
    // Preencher checkboxes de divisão
    const checkboxPessoas = document.getElementById('checkboxPessoas');
    checkboxPessoas.innerHTML = '';
    pessoas.forEach(pessoa => {
        checkboxPessoas.innerHTML += `
            <div class="checkbox-item">
                <input type="checkbox" id="pessoa_${pessoa.id}" value="${pessoa.id}" checked>
                <label for="pessoa_${pessoa.id}">${pessoa.nome}</label>
            </div>
        `;
    });
    
    document.getElementById('modalDespesa').classList.add('active');
}

// Fechar modal de despesa
function fecharModalDespesa() {
    document.getElementById('modalDespesa').classList.remove('active');
    document.getElementById('formDespesa').reset();
    document.getElementById('previewFoto').innerHTML = '';
}

// Preview da foto ou arquivo
function previewArquivo(e) {
    const file = e.target.files[0];
    const preview = document.getElementById('previewFoto');
    
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const fileType = file.type;
            
            if (fileType.startsWith('image/')) {
                // É uma imagem
                preview.innerHTML = `
                    <img src="${e.target.result}" alt="Preview do recibo">
                    <div style="margin-top: 0.5rem; font-size: 0.85rem; color: var(--text-light);">
                        ${file.name} (${(file.size / 1024).toFixed(1)} KB)
                    </div>
                `;
            } else if (fileType === 'application/pdf') {
                // É um PDF
                preview.innerHTML = `
                    <div style="padding: 1rem; background: var(--bg); border-radius: 8px; text-align: center;">
                        <div style="font-size: 3rem; margin-bottom: 0.5rem;">📄</div>
                        <div style="font-weight: 500;">${file.name}</div>
                        <div style="font-size: 0.85rem; color: var(--text-light); margin-top: 0.25rem;">
                            PDF • ${(file.size / 1024).toFixed(1)} KB
                        </div>
                    </div>
                `;
            } else {
                // Outro tipo de arquivo
                preview.innerHTML = `
                    <div style="padding: 1rem; background: var(--bg); border-radius: 8px; text-align: center;">
                        <div style="font-size: 3rem; margin-bottom: 0.5rem;">📎</div>
                        <div style="font-weight: 500;">${file.name}</div>
                        <div style="font-size: 0.85rem; color: var(--text-light); margin-top: 0.25rem;">
                            ${(file.size / 1024).toFixed(1)} KB
                        </div>
                    </div>
                `;
            }
        };
        reader.readAsDataURL(file);
    }
}

// Salvar despesa
async function salvarDespesa(e) {
    e.preventDefault();
    
    const descricao = document.getElementById('descricao').value;
    const valor = parseFloat(document.getElementById('valor').value);
    const pagadorId = parseInt(document.getElementById('pagador').value);
    
    // Pegar pessoas selecionadas
    const pessoasSelecionadas = [];
    document.querySelectorAll('#checkboxPessoas input[type="checkbox"]:checked').forEach(checkbox => {
        pessoasSelecionadas.push(parseInt(checkbox.value));
    });
    
    if (pessoasSelecionadas.length === 0) {
        alert('Selecione pelo menos uma pessoa para dividir a despesa');
        return;
    }
    
    // Processar foto/arquivo se houver
    let arquivoBase64 = null;
    let arquivoNome = null;
    let arquivoTipo = null;
    
    const cameraInput = document.getElementById('cameraRecibo');
    const arquivoInput = document.getElementById('fotoRecibo');
    const inputComArquivo = cameraInput.files.length > 0 ? cameraInput : 
                            arquivoInput.files.length > 0 ? arquivoInput : null;
    
    if (inputComArquivo && inputComArquivo.files.length > 0) {
        const file = inputComArquivo.files[0];
        arquivoNome = file.name;
        arquivoTipo = file.type;
        
        const reader = new FileReader();
        reader.onload = async (e) => {
            arquivoBase64 = e.target.result;
            await finalizarSalvamento();
        };
        reader.readAsDataURL(file);
    } else {
        await finalizarSalvamento();
    }
    
    async function finalizarSalvamento() {
        try {
            const despesa = {
                id: Date.now(),
                descricao,
                valor,
                pagadorId,
                pessoasSelecionadas,
                valorPorPessoa: valor / pessoasSelecionadas.length,
                data: new Date().toISOString(),
                arquivo: arquivoBase64,
                arquivoNome: arquivoNome,
                arquivoTipo: arquivoTipo
            };
            
            await addDoc(collection(db, 'despesas'), despesa);
            fecharModalDespesa();
            mudarTab('despesas');
        } catch (error) {
            console.error('Erro ao salvar despesa:', error);
            alert('Erro ao salvar despesa. Tente novamente.');
        }
    }
}

// Remover despesa
async function removerDespesa(firebaseId) {
    if (!confirm('Tem certeza que deseja remover esta despesa?')) return;
    
    try {
        