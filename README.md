# Racha Fácil v2.0 🧾✨

App colaborativo para dividir despesas em viagens e eventos.

## 🆕 Novidades da Versão 2.0

### Auto-cadastro de Participantes
- ✅ Não precisa mais cadastrar pessoas manualmente
- ✅ Todos que fazem login automaticamente participam
- ✅ Lista de participantes atualiza em tempo real

### Despesas Customizáveis
- ✅ Selecione quem participou de cada despesa
- ✅ Informe quem pagou a conta
- ✅ Divida igualmente OU customize valores por pessoa
- ✅ Validação automática da soma

### Cálculo Otimizado
- ✅ Algoritmo que minimiza transferências
- ✅ Mostra quem deve pagar para quem
- ✅ Resumo individual de cada participante

### Recursos Mantidos
- 📸 OCR de recibos (extração automática de valores)
- 🖼️ Imagens salvas em base64 no Firestore (limite: 1MB por imagem)
- 🔄 Sincronização em tempo real
- 📱 PWA (funciona offline)
- 🔐 Autenticação Google

## 🎯 Caso de Uso

**Viagem de 10 dias entre amigos:**

1. Todos fazem login no app
2. Durante a viagem, qualquer um adiciona despesas:
   - "Pizza R$ 80" → João, Maria e Pedro participam
   - "Uber R$ 30" → Só João e Maria
   - "Hotel R$ 600" → Todos participam
3. No final da viagem: clica em "Calcular Acerto"
4. O app mostra quem deve pagar para quem (otimizado!)

## 📊 Estrutura de Dados

```javascript
users/ (auto-cadastro)
  {uid}/
    name, email, photoURL, lastLogin

expenses/
  {expenseId}/
    description: "Pizza"
    totalValue: 80
    paidBy: "uid_de_quem_pagou"
    splits: {
      "uid1": 30,
      "uid2": 25,
      "uid3": 25
    }
    imageBase64: "data:image/jpeg;base64,..." // Imagem em base64
    createdBy: "uid"
    createdAt: timestamp
```

## 🔧 Como Usar

### 1. Adicionar Despesa

1. Clique no botão "+"
2. (Opcional) Fotografe o recibo (OCR extrai o valor)
3. Preencha descrição e valor
4. Selecione **quem pagou**
5. Marque os **participantes** da despesa
6. Escolha: "Dividir Igualmente" ou "Valores Customizados"
7. Salve

### 2. Calcular Acerto

1. Clique em "Calcular Acerto"
2. Veja o resumo individual (quem deve/recebe)
3. Veja as transferências necessárias (otimizadas!)

## 🧮 Algoritmo de Otimização

O app usa um algoritmo de **balanço de dívidas** que:

1. Calcula quanto cada pessoa pagou vs. quanto deve
2. Identifica credores (saldo positivo) e devedores (saldo negativo)
3. Encontra o maior credor e maior devedor
4. Cria transferência entre eles
5. Repete até zerar todos os balanços

**Resultado:** Mínimo de transferências necessárias! 🎉

### Exemplo:

**Sem otimização:**
- Maria paga R$ 20 para João
- Maria paga R$ 20 para Pedro
- Lucas paga R$ 30 para João
- Lucas paga R$ 10 para Pedro
*Total: 4 transferências*

**Com otimização:**
- Maria paga R$ 40 para João
- Lucas paga R$ 30 para João
- Lucas paga R$ 10 para Pedro
*Total: 3 transferências* ✅

## 🚀 Deploy

1. Faça upload dos arquivos para o GitHub Pages
2. Configure Firebase (Authentication e Firestore apenas - **não precisa de Storage**)
3. Atualize as regras do Firestore:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId;
    }
    
    match /expenses/{expenseId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update, delete: if request.auth.uid == resource.data.createdBy;
    }
  }
}
```

## 📱 Compatibilidade

- ✅ Chrome/Edge (desktop e mobile)
- ✅ Safari (iOS)
- ✅ Firefox
- ✅ PWA instalável
- ✅ Funciona offline (após primeira carga)

## 🎨 Tecnologias

- HTML5 + CSS3 + JavaScript
- Firebase (Auth e Firestore)
- Tesseract.js (OCR)
- Material Icons
- Service Worker (PWA)
- Base64 para armazenamento de imagens

## 📝 Próximas Melhorias

- [ ] Múltiplos eventos/viagens
- [ ] Histórico de acertos passados
- [ ] Exportar relatório em PDF
- [ ] Gráficos de gastos
- [ ] Notificações push
- [ ] Categorias de despesas
- [ ] Multi-moeda

---

**Desenvolvido para viagens inesquecíveis sem dor de cabeça! 🏖️💰**
