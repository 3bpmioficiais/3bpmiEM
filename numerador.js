/**
 * numerador.js - Módulo exclusivo do Numerador de Documentos
 * 3º Batalhão de Caçadores
 */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtData = d => d ? d.split('-').reverse().join('/') : '';
  const getDb = () => window.db || (typeof db !== 'undefined' ? db : null);
  const getUsuario = () => window.usuario || (typeof usuario !== 'undefined' ? usuario : null);

  const getAviso = (msg, erro) => {
    if (typeof aviso === 'function') aviso(msg, erro);
    else if (typeof window.aviso === 'function') window.aviso(msg, erro);
    else alert(msg);
  };

  const getConfirmarSenha = async (texto) => {
    if (typeof confirmarSenha === 'function') return await confirmarSenha(texto);
    if (typeof window.confirmarSenha === 'function') return await window.confirmarSenha(texto);
    return confirm(texto);
  };

  const TIPOS_DOCS = [
    'MENSAGEM ELETRÔNICA',
    'OFÍCIO',
    'MEMORANDO',
    'PARTE',
    'NBI',
    'ATA RAC',
    'ATA REUNIÃO',
    'ORDEM DE SERVIÇO',
    'ORDEM DE OPERAÇÕES',
    'EVENTO',
    'FUTEBOL'
  ];

  const getCodigo = () => (typeof CONFIG !== 'undefined' && CONFIG.CODIGO) ? CONFIG.CODIGO : '06';
  const fmtDocNum = r => `${String(r.numero).padStart(3, '0')}/${getCodigo()}/${r.ano}`;

  let docs = { lista: [], editando: null };

  // Busca o próximo número sequencial para um tipo e ano específico
  async function obterProximoNumero(tipo, ano) {
    const dbClient = getDb();
    if (!dbClient) return 1;
    // Não filtra por excluido: garante que números deletados nunca sejam reutilizados
    const { data, error } = await dbClient
      .from('documentos_pm')
      .select('numero')
      .eq('tipo', tipo)
      .eq('ano', ano)
      .order('numero', { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) return 1;
    return (data[0].numero || 0) + 1;
  }

  // Atualiza em tempo real o campo de previsão do próximo número
  async function atualizarPrevisao() {
    const tipo = $('#numTipo')?.value;
    const dataVal = $('#numData')?.value || new Date().toISOString().slice(0, 10);
    const ano = parseInt(dataVal.split('-')[0], 10);
    const prevEl = $('#numPrevisao');
    if (!prevEl || !tipo || !ano) return;

    prevEl.value = 'Calculando…';
    try {
      const prox = await obterProximoNumero(tipo, ano);
      prevEl.value = `${prox < 10 ? '00' : prox < 100 ? '0' : ''}${prox}/${getCodigo()}/${ano}`;
    } catch {
      prevEl.value = '---';
    }
  }

  async function carregarDocs() {
    const ano = parseInt($('#numFiltroAno').value, 10);
    const tipoFiltro = $('#numFiltroTipo').value;
    $('#numCorpo').innerHTML = '<tr><td colspan="4" class="cont">Carregando documentos…</td></tr>';

    const dbClient = getDb();
    if (!dbClient) {
      $('#numCorpo').innerHTML = '<tr><td colspan="4" class="msg-erro">Conexão indisponível.</td></tr>';
      return;
    }

    let query = dbClient
      .from('documentos_pm')
      .select('*')
      .eq('excluido', false)
      .eq('ano', ano)
      .order('numero', { ascending: false });

    if (tipoFiltro) {
      query = query.eq('tipo', tipoFiltro);
    }

    const { data, error } = await query;
    if (error) {
      $('#numCorpo').innerHTML = '<tr><td colspan="4" class="msg-erro">Erro ao carregar documentos.</td></tr>';
      return;
    }

    docs.lista = data || [];
    listarDocs();
  }

  function listarDocs() {
    const q = ($('#numBusca')?.value || '').toLowerCase().trim();
    const filtrados = docs.lista.filter(r => {
      const numFmt = fmtDocNum(r).toLowerCase();
      const txt = `${numFmt} ${r.tipo} ${fmtData(r.data)} ${r.assunto || ''} ${r.interessado || ''}`.toLowerCase();
      return txt.includes(q);
    });

    if (!filtrados.length) {
      $('#numCorpo').innerHTML = '<tr><td colspan="4" class="cont">Nenhum documento encontrado.</td></tr>';
      return;
    }

    $('#numCorpo').innerHTML = filtrados.map(r => `
      <tr>
        <td class="nw">
          <b>${fmtDocNum(r)}</b><br>
          <span class="tag">${esc(r.tipo)}</span>
        </td>
        <td class="nw">${fmtData(r.data)}</td>
        <td>
          <b>${esc(r.assunto)}</b>
          ${r.interessado ? `<br><small class="cont">Destinatário/Interessado: ${esc(r.interessado)}</small>` : ''}
        </td>
        <td class="nw">
          <button class="mini" data-ned="${esc(r.id)}">Editar</button>
          <button class="mini perigo" data-nex="${esc(r.id)}">Excluir</button>
        </td>
      </tr>
    `).join('');
  }

  function garantirDialogs() {
    if (!$('#dNumerador')) {
      document.body.insertAdjacentHTML('beforeend', `
        <!-- Diálogo Principal: Numerador de Documentos -->
        <dialog id="dNumerador">
          <div class="topo">
            <h2>Numerador de Documentos</h2>
            <button class="mini" data-fechar>Fechar</button>
          </div>

          <form id="fNumNovo" class="fr-form">
            <h3>Gerar nova numeração</h3>
            <div class="dupla">
              <label>Tipo de Documento
                <select id="numTipo" required>
                  ${TIPOS_DOCS.map(t => `<option value="${t}">${t}</option>`).join('')}
                </select>
              </label>
              <label>Data do Documento
                <input type="date" id="numData" required>
              </label>
            </div>

            <div class="dupla">
              <label>Destinatário / Interessado / Referência
                <input type="text" id="numInteressado" placeholder="Ex: Cmt do Batalhão, Seção de Pessoal, etc.">
              </label>
              <label>Próximo número previsto
                <input type="text" id="numPrevisao" readonly style="color:var(--ok);font-weight:700">
              </label>
            </div>

            <label>Assunto / Ementa
              <textarea id="numAssunto" required placeholder="Descreva o conteúdo do documento"></textarea>
            </label>

            <div class="acoes">
              <button class="btn" id="bNumGerar">Gerar Numeração</button>
            </div>
          </form>

          <div class="fr-topo">
            <h3>Documentos Gerados</h3>
            <div style="display:flex;gap:10px;flex-wrap:wrap">
              <select id="numFiltroTipo" aria-label="Filtrar por tipo de documento">
                <option value="">Todos os tipos</option>
                ${TIPOS_DOCS.map(t => `<option value="${t}">${t}</option>`).join('')}
              </select>
              <select id="numFiltroAno" aria-label="Filtrar por ano"></select>
            </div>
          </div>

          <input type="search" id="numBusca" placeholder="Buscar por número, data, assunto ou interessado" aria-label="Buscar documento">

          <div class="tw">
            <table>
              <thead>
                <tr>
                  <th>Número</th>
                  <th>Data</th>
                  <th>Assunto</th>
                  <th></th>
                </tr>
              </thead>
              <tbody id="numCorpo"></tbody>
            </table>
          </div>
        </dialog>

        <!-- Diálogo: Editar Documento -->
        <dialog id="dNumEd">
          <form id="fNumEd">
            <h2 id="numEdTitulo">Editar Documento</h2>
            <label>Data<input type="date" id="numEdData" required></label>
            <label>Destinatário / Interessado<input type="text" id="numEdInteressado"></label>
            <label>Assunto<textarea id="numEdAssunto" required></textarea></label>
            <div class="acoes">
              <button type="button" class="btn ghost" data-fechar>Cancelar</button>
              <button class="btn">Salvar alterações</button>
            </div>
          </form>
        </dialog>
      `);
    }
  }

  function montarFiltroAnos() {
    const anoSel = $('#numFiltroAno');
    if (!anoSel || anoSel.options.length) return;
    const anoAtual = new Date().getFullYear();
    anoSel.innerHTML = [anoAtual, anoAtual - 1, anoAtual - 2, anoAtual + 1]
      .map(y => `<option value="${y}">${y}</option>`).join('');
    anoSel.value = anoAtual;
  }

  function abrirNumerador() {
    garantirDialogs();
    montarFiltroAnos();

    const hoje = new Date().toISOString().slice(0, 10);
    if (!$('#numData').value) $('#numData').value = hoje;

    atualizarPrevisao();
    carregarDocs();
    $('#dNumerador').showModal();
  }

  function inicializarEventos() {
    garantirDialogs();

    // Abre ao clicar em qualquer botão com atributo [data-numerador] ou pelo ID #btnNumerador
    document.addEventListener('click', e => {
      if (e.target.closest('#btnNumerador') || e.target.closest('[data-numerador]')) {
        abrirNumerador();
      }
    });

    $('#numTipo').onchange = atualizarPrevisao;
    $('#numData').onchange = atualizarPrevisao;
    $('#numFiltroTipo').onchange = carregarDocs;
    $('#numFiltroAno').onchange = carregarDocs;
    $('#numBusca').oninput = listarDocs;

    // Gerar novo número
    $('#fNumNovo').onsubmit = async e => {
      e.preventDefault();
      const b = $('#bNumGerar');
      const tipo = $('#numTipo').value;
      const dataVal = $('#numData').value;
      const ano = parseInt(dataVal.split('-')[0], 10);
      const assunto = $('#numAssunto').value.trim();
      const interessado = $('#numInteressado').value.trim();
      const u = getUsuario();
      const dbClient = getDb();

      if (!assunto) return getAviso('Preencha o assunto do documento.', 1);

      b.disabled = true;
      try {
        // Sequencial individual e atômico
        const numero = await obterProximoNumero(tipo, ano);
        const novoDoc = {
          tipo,
          numero,
          ano,
          data: dataVal,
          assunto,
          interessado,
          secao: (typeof secaoAtual !== 'undefined' ? secaoAtual : ''),
          registrado_por: u ? u.email : '',
          excluido: false
        };

        const { data, error } = await dbClient.from('documentos_pm').insert(novoDoc).select().single();
        if (error) throw error;

        getAviso(`${tipo} gerado: ${fmtDocNum(data)}`);
        $('#numAssunto').value = '';
        $('#numInteressado').value = '';
        atualizarPrevisao();
        carregarDocs();
      } catch (err) {
        console.error(err);
        getAviso('Não foi possível gerar a numeração. Verifique a conexão.', 1);
      } finally {
        b.disabled = false;
      }
    };

    // Ações de Editar e Excluir
    $('#numCorpo').addEventListener('click', async e => {
      const bEd = e.target.closest('[data-ned]'), bEx = e.target.closest('[data-nex]');
      if (!bEd && !bEx) return;

      const id = (bEd || bEx).dataset[bEd ? 'ned' : 'nex'];
      const r = docs.lista.find(x => String(x.id) === String(id));
      if (!r) return;

      const refDoc = `${r.tipo} Nº ${fmtDocNum(r)}`;

      // EDITAR (Com confirmação por senha)
      if (bEd) {
        if (!await getConfirmarSenha(`Editar ${refDoc}.`)) return;
        docs.editando = r;
        $('#numEdTitulo').textContent = `Editar: ${refDoc}`;
        $('#numEdData').value = r.data;
        $('#numEdInteressado').value = r.interessado || '';
        $('#numEdAssunto').value = r.assunto || '';
        $('#dNumEd').showModal();
      }
      // EXCLUIR (Com confirmação por senha)
      else if (bEx) {
        if (!await getConfirmarSenha(`Excluir ${refDoc}. O documento sairá da lista e o histórico será preservado.`)) return;
        const dbClient = getDb();
        const { error } = await dbClient.from('documentos_pm').update({ excluido: true }).eq('id', r.id);
        if (error) return getAviso('Não foi possível excluir. Verifique sua permissão.', 1);

        getAviso('Documento excluído com sucesso.');
        carregarDocs();
        atualizarPrevisao();
      }
    });

    // Salvar edição
    $('#fNumEd').onsubmit = async e => {
      e.preventDefault();
      const dbClient = getDb();
      const { error } = await dbClient.from('documentos_pm').update({
        data: $('#numEdData').value,
        interessado: $('#numEdInteressado').value.trim(),
        assunto: $('#numEdAssunto').value.trim()
      }).eq('id', docs.editando.id);

      if (error) return getAviso('Não foi possível salvar as alterações.', 1);

      $('#dNumEd').close();
      getAviso('Documento atualizado com sucesso.');
      carregarDocs();
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarEventos);
  } else {
    inicializarEventos();
  }

  window.abrirNumerador = abrirNumerador;
})();
