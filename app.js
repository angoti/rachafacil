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
    signOut,
    setPersistence,
    browserLocalPersistence,
    browserSessionPersistence
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

// Configurar persistência de sessão
console.log('Configurando persistencia de sessao...');
setPersistence(auth, browserLocalPersistence)
    .then(() => {
        console.log('[OK] Persistencia configurada: LOCAL');
    })
    .catch((error) => {
        console.error('[ERRO] Falha ao configurar persistencia:', error);
        console.log('Tentando persistencia de sessao...');
        return setPersistence(auth, browserSessionPersistence);
    })
    .then(() => {
        console.log('[OK] Persistencia de sessao OK');
    })
    .catch((error) => {
        console.error('[ERRO] Nenhuma persistencia funcionou:', error);
        alert('AVISO: Cookies ou armazenamento local podem estar bloqueados. O login pode nao funcionar.');
    });

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
let currentImageFile = null; // Armazenar imagem atual para OCR
let despesaEmEdicao = null; // Armazenar despesa sendo editada

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
    const hadPendingRedirect = localStorage.getItem('pendingGoogleRedirect');
    console.log('Tinha redirect pendente?', hadPendingRedirect);
    
    if (hadPendingRedirect) {
        console.log('Limpando flag de redirect...');
        localStorage.removeItem('pendingGoogleRedirect');
    }
    
    getRedirectResult(auth)
        .then((result) => {
            console.log('=== REDIRECT RESULT COMPLETO ===');
            console.log('Result object:', result);
            console.log('Result type:', typeof result);
            console.log('Result keys:', result ? Object.keys(result) : 'null');
            console.log('Had pending redirect:', hadPendingRedirect);
            
            if (result && result.user) {
                currentUser = result.user;
                console.log('[OK] Login por redirect OK:', currentUser.displayName);
                console.log('User UID:', currentUser.uid);
                console.log('User email:', currentUser.email);
            } else {
                if (hadPendingRedirect) {
                    console.error('[ERRO] Tinha redirect pendente mas result e null!');
                    console.error('Possivel causa: cookies/storage bloqueados ou modo anonimo');
                } else {
                    console.log('Nenhum redirect pendente ou user null');
                }
                console.log('Result:', result);
            }
        })
        .catch((error) => {
            console.error('[ERRO] no redirect:', error);
            console.error('Codigo do erro:', error.code);
            console.error('Mensagem:', error.message);
            console.error('Error completo:', JSON.stringify(error, null, 2));
            if (error.code === 'auth/unauthorized-domain') {
                alert('ERRO: Dominio nao autorizado no Firebase. Adicione angoti.github.io nos dominios autorizados.');
            } else if (error.code) {
                alert('Erro no login: ' + error.code + '\n\n' + error.message);
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
    
    // Verificar se localStorage está disponível
    try {
        localStorage.setItem('test', 'test');
        localStorage.removeItem('test');
        console.log('[OK] localStorage disponivel');
    } catch (e) {
        console.error('[ERRO] localStorage bloqueado:', e);
        alert('ERRO: Armazenamento local bloqueado!\n\nSolucao:\n1. Configuracoes do navegador\n2. Privacidade\n3. Habilite cookies e armazenamento para este site');
        return;
    }
    
    // Verificar se cookies estão habilitados
    const cookiesEnabled = navigator.cookieEnabled;
    console.log('Cookies habilitados:', cookiesEnabled);
    if (!cookiesEnabled) {
        alert('ERRO: Cookies desabilitados!\n\nHabilite cookies no navegador para fazer login.');
        return;
    }
    
    const btnGoogleLogin = document.getElementById('btnGoogleLogin');
    
    try {
        // Desabilitar botão durante login
        btnGoogleLogin.disabled = true;
        btnGoogleLogin.textContent = 'Carregando...';
        console.log('Botao desabilitado');
        
        // SEMPRE TENTAR POPUP PRIMEIRO (mais confiável que redirect no seu caso)
        console.log('[POPUP] Tentando signInWithPopup...');
        console.log('Auth:', auth);
        console.log('Provider:', googleProvider);
        
        try {
            const result = await signInWithPopup(auth, googleProvider);
            currentUser = result.user;
            console.log('[OK] Login popup OK:', currentUser.displayName);
            console.log('User UID:', currentUser.uid);
            console.log('User email:', currentUser.email);
            // Login bem sucedido, não precisa fazer mais nada
            return;
        } catch (popupError) {
            console.error('[ERRO] Popup falhou:', popupError.code);
            
            if (popupError.code === 'auth/popup-blocked' || popupError.code === 'auth/cancelled-popup-request') {
                console.log('Popup bloqueado, tentando redirect...');
                
                // Salvar flag no localStorage
                localStorage.setItem('pendingGoogleRedirect', 'true');
                console.log('Flag de redirect salva');
                
                await signInWithRedirect(auth, googleProvider);
                console.log('Redirect chamado');
                return;
            } else {
                // Outro erro, propagar
                throw popupError;
            }
        }
    } catch (error) {
        console.error('');
        console.error('=== ERRO NO LOGIN ===');
        console.error('Error object completo:', error);
        console.error('Codigo:', error.code);
        console.error('Mensagem:', error.message);
        console.error('Stack:', error.stack);
        
        let mensagemErro = 'Erro ao fazer login: ' + error.code;
        
        if (error.code === 'auth/popup-closed-by-user') {
            mensagemErro = 'Voce fechou a janela de login.';
        } else if (error.code === 'auth/unauthorized-domain') {
            mensagemErro = 'ERRO: Dominio nao autorizado no Firebase.';
        } else if (error.code === 'auth/network-request-failed') {
            mensagemErro = 'Erro de rede. Verifique sua conexao.';
        }
        
        alert(mensagemErro);
        
        // Reabilitar botão
        btnGoogleLogin.disabled = false;
        btnGoogleLogin.textContent = 'Entrar com Google';
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
    
    // Botão OCR
    document.getElementById('btnExtrairValor').addEventListener('click', extrairValorComOCR);
    
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

// Editar despesa
function editarDespesa(firebaseId) {
    const despesa = despesas.find(d => d.firebaseId === firebaseId);
    if (!despesa) return;
    
    despesaEmEdicao = firebaseId;
    
    // Mudar título do modal
    document.getElementById('tituloModal').textContent = 'Editar Despesa';
    
    // Preencher campos
    document.getElementById('descricao').value = despesa.descricao;
    document.getElementById('valor').value = despesa.valor.toFixed(2);
    
    // Preencher select de pagador
    const selectPagador = document.getElementById('pagador');
    selectPagador.innerHTML = '<option value="">Selecione...</option>';
    pessoas.forEach(pessoa => {
        const selected = pessoa.id === despesa.pagadorId ? 'selected' : '';
        selectPagador.innerHTML += `<option value="${pessoa.id}" ${selected}>${pessoa.nome}</option>`;
    });
    
    // Preencher checkboxes de divisão
    const checkboxPessoas = document.getElementById('checkboxPessoas');
    checkboxPessoas.innerHTML = '';
    pessoas.forEach(pessoa => {
        const checked = despesa.pessoasSelecionadas.includes(pessoa.id) ? 'checked' : '';
        checkboxPessoas.innerHTML += `
            <div class="checkbox-item">
                <input type="checkbox" id="pessoa_${pessoa.id}" value="${pessoa.id}" ${checked}>
                <label for="pessoa_${pessoa.id}">${pessoa.nome}</label>
            </div>
        `;
    });
    
    // Mostrar preview do arquivo se existir
    if (despesa.arquivo) {
        const preview = document.getElementById('previewFoto');
        const tipo = despesa.arquivoTipo || 'image/jpeg';
        const nome = despesa.arquivoNome || 'recibo.jpg';
        
        if (tipo.startsWith('image/')) {
            preview.innerHTML = `
                <img src="${despesa.arquivo}" alt="Recibo" id="imagemRecibo">
                <div style="margin-top: 0.5rem; font-size: 0.85rem; color: var(--text-light);">
                    ${nome}
                </div>
            `;
        } else if (tipo === 'application/pdf') {
            preview.innerHTML = `
                <div style="padding: 1rem; background: var(--bg); border-radius: 8px; text-align: center;">
                    <div style="font-size: 3rem; margin-bottom: 0.5rem;">📄</div>
                    <div style="font-weight: 500;">${nome}</div>
                </div>
            `;
        }
    }
    
    // Abrir modal
    document.getElementById('modalDespesa').classList.add('active');
}

// Abrir modal de despesa
function abrirModalDespesa() {
    if (pessoas.length === 0) {
        alert('Cadastre pelo menos uma pessoa primeiro');
        mudarTab('pessoas');
        return;
    }
    
    // Resetar modo de edição
    despesaEmEdicao = null;
    document.getElementById('tituloModal').textContent = 'Nova Despesa';
    
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
    document.getElementById('btnExtrairValor').style.display = 'none';
    document.getElementById('ocrStatus').style.display = 'none';
    document.getElementById('ocrStatus').innerHTML = '';
    currentImageFile = null;
    despesaEmEdicao = null;
    document.getElementById('tituloModal').textContent = 'Nova Despesa';
}

// Extrair valor do recibo usando OCR
async function extrairValorComOCR() {
    if (!currentImageFile) {
        alert('Nenhuma imagem selecionada');
        return;
    }
    
    const btnOcr = document.getElementById('btnExtrairValor');
    const ocrStatus = document.getElementById('ocrStatus');
    const campoValor = document.getElementById('valor');
    
    try {
        // Desabilitar botão e mostrar status
        btnOcr.disabled = true;
        btnOcr.textContent = '⏳ Processando...';
        ocrStatus.style.display = 'block';
        ocrStatus.innerHTML = `
            <div style="padding: 1rem; background: var(--bg); border-radius: 8px; text-align: center;">
                <div style="font-size: 0.9rem; color: var(--text);">
                    Analisando recibo... Isso pode levar alguns segundos.
                </div>
            </div>
        `;
        
        console.log('Iniciando OCR...');
        
        // Processar imagem com Tesseract
        const result = await Tesseract.recognize(
            currentImageFile,
            'por', // Português
            {
                logger: (m) => {
                    if (m.status === 'recognizing text') {
                        const progress = Math.round(m.progress * 100);
                        ocrStatus.innerHTML = `
                            <div style="padding: 1rem; background: var(--bg); border-radius: 8px;">
                                <div style="font-size: 0.9rem; color: var(--text); margin-bottom: 0.5rem;">
                                    Analisando: ${progress}%
                                </div>
                                <div style="background: var(--border); height: 8px; border-radius: 4px; overflow: hidden;">
                                    <div style="background: var(--primary); height: 100%; width: ${progress}%; transition: width 0.3s;"></div>
                                </div>
                            </div>
                        `;
                    }
                }
            }
        );
        
        console.log('OCR concluído:', result.data.text);
        
        // Extrair valores do texto
        const texto = result.data.text;
        const valores = extrairValoresDoTexto(texto);
        
        if (valores.length > 0) {
            // Se encontrou múltiplos valores, mostrar opções
            if (valores.length > 1) {
                ocrStatus.innerHTML = `
                    <div style="padding: 1rem; background: var(--bg); border-radius: 8px;">
                        <div style="font-size: 0.9rem; font-weight: 500; margin-bottom: 0.75rem;">
                            Valores encontrados (clique para usar):
                        </div>
                        ${valores.map((v, i) => `
                            <button type="button" onclick="selecionarValor(${v})" 
                                    style="display: block; width: 100%; padding: 0.75rem; margin-bottom: 0.5rem; 
                                           background: white; border: 2px solid var(--border); border-radius: 8px; 
                                           cursor: pointer; font-size: 1.1rem; font-weight: 600; color: var(--primary);">
                                R$ ${v.toFixed(2)}
                            </button>
                        `).join('')}
                    </div>
                `;
            } else {
                // Apenas um valor, usar automaticamente
                const valor = valores[0];
                campoValor.value = valor.toFixed(2);
                campoValor.focus();
                ocrStatus.innerHTML = `
                    <div style="padding: 1rem; background: var(--secondary); color: white; border-radius: 8px; text-align: center;">
                        ✓ Valor extraído: R$ ${valor.toFixed(2)}
                    </div>
                `;
                setTimeout(() => {
                    ocrStatus.style.display = 'none';
                }, 3000);
            }
        } else {
            ocrStatus.innerHTML = `
                <div style="padding: 1rem; background: #FEF3C7; border: 2px solid #F59E0B; border-radius: 8px; text-align: center;">
                    <div style="color: #92400E; font-size: 0.9rem;">
                        ⚠️ Nenhum valor encontrado no recibo. Digite manualmente.
                    </div>
                </div>
            `;
        }
        
        // Reabilitar botão
        btnOcr.disabled = false;
        btnOcr.textContent = '🔍 Extrair valor do recibo';
        
    } catch (error) {
        console.error('Erro no OCR:', error);
        ocrStatus.innerHTML = `
            <div style="padding: 1rem; background: var(--danger); color: white; border-radius: 8px; text-align: center;">
                ❌ Erro ao processar imagem. Tente novamente ou digite manualmente.
            </div>
        `;
        btnOcr.disabled = false;
        btnOcr.textContent = '🔍 Extrair valor do recibo';
    }
}

// Extrair valores numéricos do texto OCR
function extrairValoresDoTexto(texto) {
    console.log('Texto extraído:', texto);
    
    // Patterns para detectar valores em reais
    const patterns = [
        /R\$?\s*(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})/gi,  // R$ 1.234,56 ou R$1234.56
        /(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})/g,           // 1.234,56 ou 1234.56
        /total[:\s]*(\d+[.,]\d{2})/gi,                 // Total: 123.45
        /valor[:\s]*(\d+[.,]\d{2})/gi,                 // Valor: 123.45
    ];
    
    const valoresEncontrados = new Set();
    
    patterns.forEach(pattern => {
        const matches = texto.matchAll(pattern);
        for (const match of matches) {
            let valorStr = match[1] || match[0];
            // Normalizar: trocar vírgula por ponto e remover pontos de milhar
            valorStr = valorStr.replace(/\./g, '').replace(',', '.');
            const valor = parseFloat(valorStr);
            
            // Validar valor (entre 0.01 e 999999)
            if (!isNaN(valor) && valor > 0 && valor < 1000000) {
                valoresEncontrados.add(valor);
            }
        }
    });
    
    // Ordenar valores (maior primeiro, geralmente é o total)
    return Array.from(valoresEncontrados).sort((a, b) => b - a);
}

// Selecionar valor da lista de opções
function selecionarValor(valor) {
    const campoValor = document.getElementById('valor');
    const ocrStatus = document.getElementById('ocrStatus');
    
    campoValor.value = valor.toFixed(2);
    campoValor.focus();
    
    ocrStatus.innerHTML = `
        <div style="padding: 1rem; background: var(--secondary); color: white; border-radius: 8px; text-align: center;">
            ✓ Valor selecionado: R$ ${valor.toFixed(2)}
        </div>
    `;
    
    setTimeout(() => {
        ocrStatus.style.display = 'none';
    }, 2000);
}

// Preview da foto ou arquivo
function previewArquivo(e) {
    const file = e.target.files[0];
    const preview = document.getElementById('previewFoto');
    const btnOcr = document.getElementById('btnExtrairValor');
    const ocrStatus = document.getElementById('ocrStatus');
    
    // Limpar status anterior
    ocrStatus.style.display = 'none';
    ocrStatus.innerHTML = '';
    
    if (file) {
        currentImageFile = file; // Armazenar para OCR
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const fileType = file.type;
            
            if (fileType.startsWith('image/')) {
                // É uma imagem - mostrar botão OCR
                preview.innerHTML = `
                    <img src="${e.target.result}" alt="Preview do recibo" id="imagemRecibo">
                    <div style="margin-top: 0.5rem; font-size: 0.85rem; color: var(--text-light);">
                        ${file.name} (${(file.size / 1024).toFixed(1)} KB)
                    </div>
                `;
                btnOcr.style.display = 'block';
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
                btnOcr.style.display = 'none';
                currentImageFile = null;
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
                btnOcr.style.display = 'none';
                currentImageFile = null;
            }
        };
        reader.readAsDataURL(file);
    } else {
        btnOcr.style.display = 'none';
        currentImageFile = null;
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
            const despesaData = {
                descricao,
                valor,
                pagadorId,
                pessoasSelecionadas,
                valorPorPessoa: valor / pessoasSelecionadas.length,
                arquivo: arquivoBase64,
                arquivoNome: arquivoNome,
                arquivoTipo: arquivoTipo
            };
            
            if (despesaEmEdicao) {
                // Atualizar despesa existente
                const despesaExistente = despesas.find(d => d.firebaseId === despesaEmEdicao);
                
                // Manter arquivo antigo se não foi alterado
                if (!arquivoBase64 && despesaExistente) {
                    despesaData.arquivo = despesaExistente.arquivo;
                    despesaData.arquivoNome = despesaExistente.arquivoNome;
                    despesaData.arquivoTipo = despesaExistente.arquivoTipo;
                }
                
                await updateDoc(doc(db, 'despesas', despesaEmEdicao), despesaData);
                console.log('Despesa atualizada');
            } else {
                // Criar nova despesa
                despesaData.id = Date.now();
                despesaData.data = new Date().toISOString();
                await addDoc(collection(db, 'despesas'), despesaData);
                console.log('Despesa criada');
            }
            
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
        await deleteDoc(doc(db, 'despesas', firebaseId));
    } catch (error) {
        console.error('Erro ao remover despesa:', error);
        alert('Erro ao remover despesa. Tente novamente.');
    }
}

// Atualizar interface
function atualizarInterface() {
    renderizarPessoas();
    renderizarDespesas();
    renderizarSaldos();
}

// Renderizar lista de pessoas
function renderizarPessoas() {
    const lista = document.getElementById('listaPessoas');
    
    if (pessoas.length === 0) {
        lista.innerHTML = '<p class="empty-state">Cadastre as pessoas que participam das despesas</p>';
        return;
    }
    
    lista.innerHTML = pessoas.map(pessoa => {
        // Pegar primeira letra do nome para o avatar
        const inicial = pessoa.nome.charAt(0).toUpperCase();
        
        // Contar quantas despesas a pessoa está envolvida
        const despesasCount = despesas.filter(d => 
            d.pagadorId === pessoa.id || d.pessoasSelecionadas.includes(pessoa.id)
        ).length;
        
        return `
            <div class="pessoa-item" id="pessoa-${pessoa.firebaseId}">
                <div class="pessoa-item-content">
                    <div class="pessoa-avatar">${inicial}</div>
                    <div class="pessoa-info" style="flex: 1;">
                        <div id="nome-view-${pessoa.firebaseId}">
                            <span class="pessoa-nome">${pessoa.nome}</span>
                            ${despesasCount > 0 ? `<div class="pessoa-stats">${despesasCount} despesa${despesasCount > 1 ? 's' : ''}</div>` : ''}
                        </div>
                        <div id="nome-edit-${pessoa.firebaseId}" style="display: none; width: 100%;">
                            <input type="text" class="pessoa-nome-input" id="input-${pessoa.firebaseId}" 
                                   value="${pessoa.nome.replace(/"/g, '&quot;')}">
                        </div>
                    </div>
                </div>
                <div class="pessoa-actions">
                    <button class="btn-icon edit" onclick="editarPessoa('${pessoa.firebaseId}')" id="btn-edit-${pessoa.firebaseId}" title="Editar">
                        ✏️
                    </button>
                    <button class="btn-icon save" onclick="salvarEdicaoPessoa('${pessoa.firebaseId}')" id="btn-save-${pessoa.firebaseId}" style="display: none;" title="Salvar">
                        ✓
                    </button>
                    <button class="btn-icon cancel" onclick="cancelarEdicaoPessoa('${pessoa.firebaseId}')" id="btn-cancel-${pessoa.firebaseId}" style="display: none;" title="Cancelar">
                        ✕
                    </button>
                    <button class="btn-remover" onclick="removerPessoa('${pessoa.firebaseId}')">Remover</button>
                </div>
            </div>
        `;
    }).join('');
}

// Renderizar lista de despesas
function renderizarDespesas() {
    const lista = document.getElementById('listaDespesas');
    
    if (despesas.length === 0) {
        lista.innerHTML = '<p class="empty-state">Nenhuma despesa cadastrada ainda</p>';
        return;
    }
    
    // Ordenar despesas por data (mais recente primeiro)
    const despesasOrdenadas = [...despesas].sort((a, b) => 
        new Date(b.data) - new Date(a.data)
    );
    
    lista.innerHTML = despesasOrdenadas.map(despesa => {
        const pagador = pessoas.find(p => p.id === despesa.pagadorId);
        const participantes = despesa.pessoasSelecionadas.map(id => 
            pessoas.find(p => p.id === id)?.nome
        ).filter(Boolean);
        
        const data = new Date(despesa.data);
        const dataFormatada = data.toLocaleDateString('pt-BR');
        
        return `
            <div class="despesa-card">
                <div class="despesa-header">
                    <span class="despesa-titulo">${despesa.descricao}</span>
                    <span class="despesa-valor">R$ ${despesa.valor.toFixed(2)}</span>
                </div>
                <div class="despesa-info">
                    ${dataFormatada} • Pago por ${pagador?.nome || 'Desconhecido'}
                </div>
                <div class="despesa-info">
                    R$ ${despesa.valorPorPessoa.toFixed(2)} por pessoa
                </div>
                <div class="despesa-divisao">
                    ${participantes.map(nome => `<span class="tag">${nome}</span>`).join('')}
                </div>
                ${despesa.arquivo ? renderizarArquivo(despesa) : ''}
                <div style="margin-top: 0.75rem; display: flex; gap: 0.5rem;">
                    <button class="btn-secondary" onclick="editarDespesa('${despesa.firebaseId}')" style="flex: 1; margin: 0;">
                        ✏️ Editar
                    </button>
                    <button class="btn-remover" onclick="removerDespesa('${despesa.firebaseId}')" style="flex: 1; margin: 0;">
                        Excluir
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Renderizar arquivo anexado (imagem ou PDF)
function renderizarArquivo(despesa) {
    // Compatibilidade com versão antiga que usava 'foto'
    const arquivo = despesa.arquivo || despesa.foto;
    const tipo = despesa.arquivoTipo || 'image/jpeg';
    const nome = despesa.arquivoNome || 'recibo.jpg';
    
    if (!arquivo) return '';
    
    if (tipo.startsWith('image/')) {
        return `
            <div class="despesa-foto">
                <img src="${arquivo}" alt="Recibo" onclick="abrirArquivo('${arquivo}', '${tipo}', '${nome}')">
            </div>
        `;
    } else if (tipo === 'application/pdf') {
        return `
            <div class="despesa-foto" onclick="abrirArquivo('${arquivo}', '${tipo}', '${nome}')" style="cursor: pointer;">
                <div style="padding: 1rem; background: var(--bg); border-radius: 8px; text-align: center;">
                    <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">📄</div>
                    <div style="font-weight: 500; font-size: 0.9rem;">${nome}</div>
                    <div style="font-size: 0.75rem; color: var(--text-light); margin-top: 0.25rem;">
                        Clique para visualizar
                    </div>
                </div>
            </div>
        `;
    } else {
        return `
            <div class="despesa-foto" onclick="abrirArquivo('${arquivo}', '${tipo}', '${nome}')" style="cursor: pointer;">
                <div style="padding: 1rem; background: var(--bg); border-radius: 8px; text-align: center;">
                    <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">📎</div>
                    <div style="font-weight: 500; font-size: 0.9rem;">${nome}</div>
                    <div style="font-size: 0.75rem; color: var(--text-light); margin-top: 0.25rem;">
                        Clique para abrir
                    </div>
                </div>
            </div>
        `;
    }
}

// Abrir arquivo em nova aba ou download
function abrirArquivo(base64, tipo, nome) {
    if (tipo.startsWith('image/')) {
        // Imagem abre no lightbox
        const lightbox = document.getElementById('lightbox');
        const lightboxImg = document.getElementById('lightbox-img');
        const caption = document.getElementById('lightbox-caption');
        
        lightbox.classList.add('active');
        lightboxImg.src = base64;
        caption.textContent = nome;
        
        // Fechar lightbox ao clicar no X ou fora da imagem
        lightbox.onclick = (e) => {
            if (e.target === lightbox || e.target.classList.contains('lightbox-close')) {
                lightbox.classList.remove('active');
            }
        };
    } else {
        // PDF e outros fazem download
        const link = document.createElement('a');
        link.href = base64;
        link.download = nome;
        link.click();
    }
}

// Renderizar saldos
function renderizarSaldos() {
    const lista = document.getElementById('listaSaldos');
    
    if (despesas.length === 0) {
        lista.innerHTML = '<p class="empty-state">Cadastre despesas para ver os saldos</p>';
        return;
    }
    
    // Calcular saldos
    const saldos = {};
    pessoas.forEach(pessoa => {
        saldos[pessoa.id] = { nome: pessoa.nome, valor: 0 };
    });
    
    despesas.forEach(despesa => {
        // Quem pagou recebe o valor total
        if (saldos[despesa.pagadorId]) {
            saldos[despesa.pagadorId].valor += despesa.valor;
        }
        
        // Cada participante deve sua parte
        despesa.pessoasSelecionadas.forEach(pessoaId => {
            if (saldos[pessoaId]) {
                saldos[pessoaId].valor -= despesa.valorPorPessoa;
            }
        });
    });
    
    // Renderizar
    const saldosArray = Object.values(saldos).sort((a, b) => b.valor - a.valor);
    
    lista.innerHTML = saldosArray.map(saldo => {
        const isPositivo = saldo.valor > 0.01;
        const isNegativo = saldo.valor < -0.01;
        const classe = isPositivo ? 'saldo-positivo' : isNegativo ? 'saldo-negativo' : '';
        const classeValor = isPositivo ? 'positivo' : isNegativo ? 'negativo' : '';
        
        let texto = '';
        if (isPositivo) {
            texto = 'Deve receber';
        } else if (isNegativo) {
            texto = 'Deve pagar';
        } else {
            texto = 'Está em dia';
        }
        
        return `
            <div class="saldo-item ${classe}">
                <div style="font-weight: 600; font-size: 1.1rem;">${saldo.nome}</div>
                <div style="color: var(--text-light); font-size: 0.9rem; margin-top: 0.25rem;">
                    ${texto}
                </div>
                <div class="saldo-valor ${classeValor}">
                    R$ ${Math.abs(saldo.valor).toFixed(2)}
                </div>
            </div>
        `;
    }).join('');
}

// Tornar funções globais para onclick no HTML
window.removerPessoa = removerPessoa;
window.removerDespesa = removerDespesa;
window.abrirArquivo = abrirArquivo;
window.editarPessoa = editarPessoa;
window.salvarEdicaoPessoa = salvarEdicaoPessoa;
window.cancelarEdicaoPessoa = cancelarEdicaoPessoa;
window.selecionarValor = selecionarValor;
window.editarDespesa = editarDespesa;

// Editar pessoa
function editarPessoa(firebaseId) {
    const nomeView = document.getElementById(`nome-view-${firebaseId}`);
    const nomeEdit = document.getElementById(`nome-edit-${firebaseId}`);
    const nomeInput = document.getElementById(`input-${firebaseId}`);
    const btnEdit = document.getElementById(`btn-edit-${firebaseId}`);
    const btnSave = document.getElementById(`btn-save-${firebaseId}`);
    const btnCancel = document.getElementById(`btn-cancel-${firebaseId}`);
    
    nomeView.style.display = 'none';
    nomeEdit.style.display = 'block';
    btnEdit.style.display = 'none';
    btnSave.style.display = 'flex';
    btnCancel.style.display = 'flex';
    
    nomeInput.focus();
    nomeInput.select();
}

// Salvar edição de pessoa
async function salvarEdicaoPessoa(firebaseId) {
    const nomeInput = document.getElementById(`input-${firebaseId}`);
    const novoNome = nomeInput.value.trim();
    
    if (!novoNome) {
        alert('Digite um nome valido');
        return;
    }
    
    const pessoa = pessoas.find(p => p.firebaseId === firebaseId);
    if (!pessoa) return;
    
    // Verificar se já existe outra pessoa com esse nome
    if (pessoas.find(p => p.firebaseId !== firebaseId && p.nome.toLowerCase() === novoNome.toLowerCase())) {
        alert('Ja existe uma pessoa com esse nome');
        return;
    }
    
    try {
        await updateDoc(doc(db, 'pessoas', firebaseId), {
            nome: novoNome
        });
        cancelarEdicaoPessoa(firebaseId);
    } catch (error) {
        console.error('Erro ao atualizar pessoa:', error);
        alert('Erro ao atualizar pessoa. Tente novamente.');
    }
}

// Cancelar edição de pessoa
function cancelarEdicaoPessoa(firebaseId) {
    const pessoa = pessoas.find(p => p.firebaseId === firebaseId);
    if (!pessoa) return;
    
    const nomeView = document.getElementById(`nome-view-${firebaseId}`);
    const nomeEdit = document.getElementById(`nome-edit-${firebaseId}`);
    const nomeInput = document.getElementById(`input-${firebaseId}`);
    const btnEdit = document.getElementById(`btn-edit-${firebaseId}`);
    const btnSave = document.getElementById(`btn-save-${firebaseId}`);
    const btnCancel = document.getElementById(`btn-cancel-${firebaseId}`);
    
    nomeInput.value = pessoa.nome;
    nomeView.style.display = 'block';
    nomeEdit.style.display = 'none';
    btnEdit.style.display = 'flex';
    btnSave.style.display = 'none';
    btnCancel.style.display = 'none';
}
