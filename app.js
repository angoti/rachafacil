// Configuração Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    deleteDoc, 
    doc, 
    onSnapshot,
    enableIndexedDbPersistence 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
    migrarDadosLocalStorage();
    inicializarListeners();
    inicializarEventos();
});

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
    
    lista.innerHTML = pessoas.map(pessoa => `
        <div class="pessoa-item">
            <span class="pessoa-nome">${pessoa.nome}</span>
            <button class="btn-remover" onclick="removerPessoa('${pessoa.firebaseId}')">Remover</button>
        </div>
    `).join('');
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
                <div style="margin-top: 0.75rem;">
                    <button class="btn-remover" onclick="removerDespesa('${despesa.firebaseId}')">Excluir</button>
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
