/**
 * numerador.js - Módulo do Numerador de Documentos por Seção
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

  // Mapeamento dos códigos oficiais de cada seção
  const CODIGOS_SECAO = {
    p1: '01',
    p3: '03',
    p4: '04',
    p5: '05',
    sjd: '06'
  };

  function obterSecaoAtual() {
    return window.secaoAtual || 
           (typeof secaoAtual !== 'undefined' ? secaoAtual : '') || 
           document.querySelector('#abas [aria-current="true"]')?.dataset.aba || 
           location.hash.slice(1) || 
           'p3';
  }

  const getCodigoSecao = (sec) => CODIGOS_SECAO[sec] || '06';

  // Formato: 3BPMI-001/03/2026
  const fmtDocNum = r => {
    const cod = getCodigoSecao(r.secao);
    const num = String(r.numero).padStart(3, '0');
    return `3BPMI-${num}/${cod}/${r.ano}`;
  };

  // Armazena todos os documentos do ano carregados para filtragem instantânea
  let docs = { todos: [], editando: null };

  // Busca o próximo número sequencial exclusivo da seção, tipo e ano
  async function obterProximoNumero(tipo, ano, secao) {
    const dbClient = getDb();
    if (!dbClient) return 1;

    const { data, error } = await dbClient
      .from('documentos_pm')
      .select('numero')
      .eq('tipo', tipo)
      .eq('ano', ano)
      .eq('secao', secao)
      .order('numero', { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) return 1;
    return (data[0].numero || 0) + 1;
  }

  // Previsão do próximo número em tempo real
  async function atualizarPrevisao() {
    const tipo = $('#numTipo')?.value;
    const dataVal = $('#numData')?.value || new Date().toISOString().slice(0, 10);
    const ano = parseInt(dataVal.split('-')[0], 10);
    const secao = obterSecaoAtual();
    const prevEl = $('#numPrevisao');
    if (!prevEl || !tipo || !ano) return;

    prevEl.value = 'Calculando…';
    try {
      const prox = await obterProximoNumero(tipo, ano, secao);
      const numFmt = String(prox).padStart(3, '0');
      const cod = getCodigoSecao(secao);
      prevEl.value = `3BPMI-${numFmt}/${cod}/${ano}`;
    } catch {
      prevEl.value = '---';
    }
  }

  // Carrega todos os documentos do ano da seção ativa do banco
  async function carregarDocs() {
    const ano = parseInt($('#numFiltroAno').value, 10);
    const secao = obterSecaoAtual();
    $('#numCorpo').innerHTML = '<tr><td colspan="4" class="cont">Carregando documentos…</td></tr>';

    const dbClient = getDb();
    if (!dbClient) {
      $('#numCorpo').innerHTML = '<tr><td colspan="4" class="msg-erro">Conexão indisponível.</td></tr>';
      return;
    }

    const { data, error } = await dbClient
      .from('documentos_pm')
      .select('*')
      .eq('excluido', false)
      .eq('ano', ano)
      .eq('secao', secao)
      .order('numero', { ascending: false });

    if (error) {
      $('#numCorpo').innerHTML = '<tr><td colspan="4" class="msg-erro">Erro ao carregar documentos.</td></tr>';
      return;
    }

    docs.todos = data || [];
    listarDocs();
  }

  // Filtragem instantânea via Lista Suspensa e Busca
  function listarDocs() {
    const tipoFiltro = $('#numFiltroTipo')?.value || '';
    const q = ($('#numBusca')?.value || '').toLowerCase().trim();
    const sec = obterSecaoAtual();
    const secObj = (typeof SECOES !== 'undefined' && SECOES[sec]) ? SECOES[sec] : null;
    const nomeSec = secObj ? secObj.nome.split('·')[0].trim() : sec.toUpperCase();

    // Aplica o filtro da lista suspensa de Tipo e da busca textual
    const filtrados = docs.todos.filter(r => {
      if (tipoFiltro && r.tipo !== tipoFiltro) return false;

      if (q) {
        const numFmt = fmtDocNum(r).toLowerCase();
        const txt = `${numFmt} ${r.tipo} ${fmtData(r.data)} ${r.assunto || ''} ${r.interessado || ''}`.toLowerCase();
        if (!txt.includes(q)) return false;
      }
      return true;
    });

    // Atualiza contador informativo
    const contEl = $('#numContador');
    if (contEl) {
      if (tipoFiltro) {
        contEl.textContent = `Exibindo ${filtrados.length} ${tipoFiltro}(s) na seção ${nomeSec}.`;
      } else {
        contEl.textContent = `Exibindo todos os ${filtrados.length} documento(s) da seção ${nomeSec}.`;
      }
    }

    if (!filtrados.length) {
      const msg = tipoFiltro 
        ? `Nenhum documento do tipo "${tipoFiltro}" encontrado nesta seção.`
        : 'Nenhum documento encontrado com os filtros atuais.';
      $('#numCorpo').innerHTML = `<tr><td colspan="4" class="cont">${msg}</td></tr>`;
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
        <dialog id="dNumerador">
          <div class="topo">
            <h2 id="dNumTitulo">Numerador de Documentos</h2>
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
              <textarea id="numAssunto" required placeholder="Descreva o conteúdo ou finalidade do documento"></textarea>
            </label>

            <div class="acoes">
              <button class="btn" id="bNumGerar">Gerar Numeração</button>
            </div>
          </form>

          <div class="fr-topo" style="margin-top:20px">
            <h3>Documentos Gerados nesta Seção</h3>
          </div>

          <!-- Barra de Filtros com Listas Suspensas -->
          <div class="dupla" style="margin-bottom:10px">
            <label>Filtrar por Tipo de Documento:
              <select id="numFiltroTipo" style="font-weight:600">
                <option value="">Todos os tipos de documentos</option>
                ${TIPOS_DOCS.map(t => `<option value="${t}">${t}</option>`).join('')}
              </select>
            </label>
            <label>Ano de Referência:
              <select id="numFiltroAno" style="font-weight:600"></select>
            </label>
          </div>

          <input type="search" id="numBusca" placeholder="Buscar por número, assunto ou interessado…" aria-label="Buscar documento">
          <p class="cont" id="numContador" style="margin:6px 0 10px;font-size:.82rem"></p>

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
    const sec = obterSecaoAtual();
    if (sec === 'oficiais') {
      getAviso('O Numerador de Documentos não está disponível para a seção de Oficiais.', 1);
      return;
    }

    garantirDialogs();
    montarFiltroAnos();

    const secObj = (typeof SECOES !== 'undefined' && SECOES[sec]) ? SECOES[sec] : null;
    const nomeSec = secObj ? secObj.nome.split('·')[0].trim() : sec.toUpperCase();
    const t = $('#dNumTitulo');
    if (t) t.textContent = `Numerador de Documentos · ${nomeSec}`;

    const hoje = new Date().toISOString().slice(0, 10);
    if (!$('#numData').value) $('#numData').value = hoje;

    atualizarPrevisao();
    carregarDocs();
    $('#dNumerador').showModal();
  }

  function inicializarEventos() {
    garantirDialogs();

    document.addEventListener('click', e => {
      if (e.target.closest('#btnNumerador') || e.target.closest('[data-numerador]')) {
        abrirNumerador();
      }
    });

    $('#numTipo').onchange = atualizarPrevisao;
    $('#numData').onchange = atualizarPrevisao;

    // Filtro instantâneo pela lista suspensa de tipo de documento
    $('#numFiltroTipo').onchange = listarDocs;

    // Mudança de ano recarrega os dados daquele ano do banco
    $('#numFiltroAno').onchange = carregarDocs;

    // Filtro por digitação instantâneo
    $('#numBusca').oninput = listarDocs;

    // Gerar numeração
    $('#fNumNovo').onsubmit = async e => {
      e.preventDefault();
      const b = $('#bNumGerar');
      const tipo = $('#numTipo').value;
      const dataVal = $('#numData').value;
      const ano = parseInt(dataVal.split('-')[0], 10);
      const secao = obterSecaoAtual();
      const assunto = $('#numAssunto').value.trim();
      const interessado = $('#numInteressado').value.trim();
      const u = getUsuario();
      const dbClient = getDb();

      if (!assunto) return getAviso('Preencha o assunto do documento.', 1);

      b.disabled = true;
      try {
        const numero = await obterProximoNumero(tipo, ano, secao);
        const novoDoc = {
          tipo,
          numero,
          ano,
          data: dataVal,
          assunto,
          interessado,
          secao,
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

    // Editar e Excluir
    $('#numCorpo').addEventListener('click', async e => {
      const bEd = e.target.closest('[data-ned]'), bEx = e.target.closest('[data-nex]');
      if (!bEd && !bEx) return;

      const id = (bEd || bEx).dataset[bEd ? 'ned' : 'nex'];
      const r = docs.todos.find(x => String(x.id) === String(id));
      if (!r) return;

      const refDoc = `${r.tipo} Nº ${fmtDocNum(r)}`;

      if (bEd) {
        if (!await getConfirmarSenha(`Editar ${refDoc}.`)) return;
        docs.editando = r;
        $('#numEdTitulo').textContent = `Editar: ${refDoc}`;
        $('#numEdData').value = r.data;
        $('#numEdInteressado').value = r.interessado || '';
        $('#numEdAssunto').value = r.assunto || '';
        $('#dNumEd').showModal();
      } else if (bEx) {
        if (!await getConfirmarSenha(`Excluir ${refDoc}. O documento sairá da lista da seção.`)) return;
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
