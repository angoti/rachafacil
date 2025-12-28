// Estado da aplicação
let pessoas = [];
let despesas = [];

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    carregarDados();
    inicializarEventos();
    atualizarInterface();
});

// Carregar dados do localStorage
function carregarDados() {
    const pessoasSalvas = localStorage.getItem('pessoas');
    const despesasSalvas = localStorage.getItem('despesas');
    
    if (pessoasSalvas) pessoas = JSON.parse(pessoasSalvas);
    if (despesasSalvas) despesas = JSON.parse(despesasSalvas);
}

// Salvar dados no localStorage
function salvarDados() {
    localStorage.setItem('pessoas', JSON.stringify(pessoas));
    localStorage.setItem('despesas', JSON.stringify(despesas));
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
    
    // Preview foto
    document.getElementById('fotoRecibo').addEventListener('change', previewFoto);
    
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
function adicionarPessoa() {
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
    
    pessoas.push({
        id: Date.now(),
        nome: nome
    });
    
    input.value = '';
    salvarDados();
    atualizarInterface();
}

// Remover pessoa
function removerPessoa(id) {
    if (!confirm('Tem certeza que deseja remover esta pessoa?')) return;
    
    pessoas = pessoas.filter(p => p.id !== id);
    salvarDados();
    atualizarInterface();
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

// Preview da foto
function previewFoto(e) {
    const file = e.target.files[0];
    const preview = document.getElementById('previewFoto');
    
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            preview.innerHTML = `<img src="${e.target.result}" alt="Preview do recibo">`;
        };
        reader.readAsDataURL(file);
    }
}

// Salvar despesa
function salvarDespesa(e) {
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
    
    // Processar foto se houver
    let fotoBase64 = null;
    const fotoInput = document.getElementById('fotoRecibo');
    if (fotoInput.files.length > 0) {
        const reader = new FileReader();
        reader.onload = (e) => {
            fotoBase64 = e.target.result;
            finalizarSalvamento();
        };
        reader.readAsDataURL(fotoInput.files[0]);
    } else {
        finalizarSalvamento();
    }
    
    function finalizarSalvamento() {
        const despesa = {
            id: Date.now(),
            descricao,
            valor,
            pagadorId,
            pessoasSelecionadas,
            valorPorPessoa: valor / pessoasSelecionadas.length,
            data: new Date().toISOString(),
            foto: fotoBase64
        };
        
        despesas.push(despesa);
        salvarDados();
        fecharModalDespesa();
        atualizarInterface();
        mudarTab('despesas');
    }
}

// Remover despesa
function removerDespesa(id) {
    if (!confirm('Tem certeza que deseja remover esta despesa?')) return;
    
    despesas = despesas.filter(d => d.id !== id);
    salvarDados();
    atualizarInterface();
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
            <button class="btn-remover" onclick="removerPessoa(${pessoa.id})">Remover</button>
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
                ${despesa.foto ? `
                    <div class="despesa-foto">
                        <img src="${despesa.foto}" alt="Recibo" onclick="abrirFoto('${despesa.foto}')">
                    </div>
                ` : ''}
                <div style="margin-top: 0.75rem;">
                    <button class="btn-remover" onclick="removerDespesa(${despesa.id})">Excluir</button>
                </div>
            </div>
        `;
    }).join('');
}

// Abrir foto em tamanho maior
function abrirFoto(src) {
    window.open(src, '_blank');
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
