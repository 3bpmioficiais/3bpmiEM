/**
 * controle_frequencia.js - Módulo exclusivo do Controle de Frequência
 * 3º Batalhão de Caçadores
 */
(() => {
  // Atalhos locais protegidos contra conflitos de escopo
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

  // Efetivo de cada seção para o Controle de Frequência
  const EFETIVOS_POR_SECAO = {
    oficiais: {
      'Oficiais': (typeof NOMES !== 'undefined' ? NOMES : (window.NOMES || [
        'Ten Cel PM Eduardo','Maj PM Martins Ribeiro','Maj PM Luana','Cap PM Cravero','Cap PM Del Vecchio',
        'Cap PM André Luís','Ten PM Felipe Carvalho','Ten PM Ribeiro','Ten PM Feitosa','Ten PM Natalia',
        'Ten PM Derick','Ten PM Chevchuk','Ten PM Zanardo','Ten PM Larissa Muniz','Ten PM Borgo'
      ]))
    },
    p1: {
      'P/1': ['Cap PM André Luís','1º Ten PM Feitosa','1º Sgt PM Pazelli','Cb PM Antônio','Cb PM Ana Cláudia','Sd PM Yamada'],
      'P/5': ['Cb PM Marcari','Sd PM Pereira','Sd PM Breno']
    },
    p3: {
      'P/3': ['Cap PM 990113-2 Cravero','2º Sgt PM 147149-0 Brito','Cb PM 980440-4 Alcebíades','Cb PM 152866-1 Neres','Cb PM 144936-2 Fukuda'],
      'Geocriminal': ['Cb PM 971085-0 Landim','Cb PM 980457-9 Cruz','Cb PM 991538-9 Aender','Cb PM 136957-1 Lucas','Cb PM 146130-3 Casio'],
      'DCap': ['1º Sgt PM 980576-1 Bino','Cb PM 134666-A Ribas','Cb PM 149535-6 Cognetti','Sd PM 192404-4 Gimenes']
    },
    p4: {
      'P/4': ['1º Ten PM Borgo','2º Sgt PM Ricardo','Cb PM Scarparo','Cb PM Zocaratto','Cb PM Duarte','Cb PM Adilson','Cb PM Zafalon','Cb PM Mingarino']
    },
    sjd: {
      'SPJMD': ['Cap PM Del Vecchio','Subten PM Boleta','Subten PM Nomura','1º Sgt PM Kill','Cb PM Alves','Sd PM Mitidieri'],
      'MARIA DA PENHA': ['Sd PM Oliveira','Sd PM Delfino'],
      'NUMEC': ['Cb PM Paulo']
    }
  };

  // Identifica a aba ativa
  function obterSecaoAtual() {
    return window.secaoAtual || 
           (typeof secaoAtual !== 'undefined' ? secaoAtual : '') || 
           document.querySelector('#abas [aria-current="true"]')?.dataset.aba || 
           location.hash.slice(1) || 
           'p3';
  }

  const efetivoAtual = () => EFETIVOS_POR_SECAO[obterSecaoAtual()] || EFETIVOS_POR_SECAO.p3;

  const grupoDe = pol => {
    const ef = efetivoAtual();
    const g = Object.keys(ef).find(k => ef[k].includes(pol));
    if (g) return g;
    for (const s of Object.values(EFETIVOS_POR_SECAO)) {
      const achou = Object.keys(s).find(k => s[k].includes(pol));
      if (achou) return achou;
    }
    return '';
  };

  const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  const DIAS = ['dom','seg','ter','qua','qui','sex','sáb'];
  const TIPOS_FREQ = [
    {id:'aglutinacao',   nome:'Aglutinação',                texto:(n)    => `${n} não trabalha neste dia, aglutinação dos 02 (dois) Meios Expedientes da semana `},
    {id:'produtividade', nome:'Folga Produtividade',        texto:(n)    => `${n} não trabalha neste dia, usufruindo folga produtividade`},
    {id:'mensal',        nome:'Folga Mensal',               texto:(n)    => `${n} não trabalha neste dia, usufruindo Folga Mensal referente ao mês de `},
    {id:'meio',          nome:'Meio Expediente', horas:1,   texto:(n, h) => `${n} trabalha das ${h.ini} às ${h.fim}, usufruindo o ${h.ord} Meio Expediente da semana `},
    {id:'inversao',      nome:'Inversão de Serviço',        texto:(n)    => `${n} não trabalha neste dia, inversão de serviço com o dia '...'. No lugar trabalha `},
    {id:'alteracao',     nome:'Alteração de Horário', horas:1, texto:(n, h) => `${n} trabalha neste dia das ${h.ini} às ${h.fim}`},
    {id:'acumulo',       nome:'Acúmulo de Meio Expediente', texto:(n)    => `${n} acumula XXXX Meio(s) Expediente(s) da semana `},
    {id:'compensacao',   nome:'Compensação',                texto:(n)    => `${n} não trabalha neste dia, usufruindo Folga Compensação referente a `}
  ];
  const tipoFreq = id => TIPOS_FREQ.find(t => t.id === id);

  const hh = v => v ? v.replace(':', 'h') : 'XXhXX';
  const dataLocal = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const isoData = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  let freq = { lista: [], ord: '1º', editando: null };

  function semanaUtil(s) {
    const d = dataLocal(s), seg = new Date(d);
    seg.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const sex = new Date(seg); sex.setDate(seg.getDate() + 4);
    return [isoData(seg), isoData(sex)];
  }

  async function contarMeios(pol, data) {
    const [a, b] = semanaUtil(data);
    const dbClient = getDb();
    if (!dbClient) throw new Error('Banco de dados indisponível');
    const { data: r, error } = await dbClient.from('frequencia_pm').select('id').eq('policial', pol).eq('tipo', 'meio').eq('excluido', false).gte('data', a).lte('data', b);
    if (error) throw error;
    return r.length;
  }

  const blocoFreq = id => $(`#fTipos [data-t="${id}"]`);
  function gerarTexto(id) {
    const bl = blocoFreq(id), q = n => bl.querySelector(`[name=${n}]`);
    return tipoFreq(id).texto($('#fPol').value, { ini: hh(q('ini')?.value), fim: hh(q('fim')?.value), ord: freq.ord });
  }

  function atualizarTexto(id, forcar) {
    const bl = blocoFreq(id);
    if (!bl) return;
    const ta = bl.querySelector('textarea'), novo = gerarTexto(id), base = ta.dataset.base || '', pol = $('#fPol').value;
    if (forcar || !ta.dataset.editado) { ta.value = novo; delete ta.dataset.editado; }
    else if (base && ta.value.startsWith(base)) ta.value = novo + ta.value.slice(base.length);
    else if (freq.pol && pol && freq.pol !== pol) ta.value = ta.value.split(freq.pol).join(pol);
    ta.dataset.base = novo;
  }

  function marcados() { return [...document.querySelectorAll('#fTipos input[type=checkbox]:checked')].map(c => c.value); }

  async function atualizarOrdinal() {
    const pol = $('#fPol').value, data = $('#fData').value;
    const blMeio = blocoFreq('meio');
    if (!blMeio) return;
    const av = blMeio.querySelector('[data-aviso]');
    if (!pol || !data) return;
    try {
      const n = await contarMeios(pol, data);
      freq.ord = n >= 2 ? '2º' : `${n + 1}º`;
      av.textContent = n >= 2 ? 'Este policial já tem 2 Meios Expedientes lançados nesta semana.' : `Será lançado como ${freq.ord} Meio Expediente da semana.`;
      atualizarTexto('meio');
    } catch (err) { console.error(err); av.textContent = 'Não foi possível conferir os Meios Expedientes da semana.'; }
  }

  function montarFormFreq() {
    const ef = efetivoAtual();
    $('#fPol').innerHTML = '<option value="">Selecione</option>' + Object.entries(ef).map(([g, l]) =>
      `<optgroup label="${esc(g)}">${l.map(n => `<option>${esc(n)}</option>`).join('')}</optgroup>`).join('');
    $('#fFiltro').innerHTML = '<option value="">Todo o efetivo</option>' + Object.entries(ef).map(([g, l]) =>
      `<optgroup label="${esc(g)}">${l.map(n => `<option>${esc(n)}</option>`).join('')}</optgroup>`).join('');
    $('#fTipos').innerHTML = TIPOS_FREQ.map(t => `<div class="tp" data-t="${t.id}">
      <label class="chk"><input type="checkbox" value="${t.id}">${esc(t.nome)}</label>
      <div class="tp-corpo" hidden>
        ${t.horas ? '<div class="horas"><label>Trabalha das:<input type="time" name="ini"></label><label>Às:<input type="time" name="fim"></label></div>' : ''}
        ${t.id === 'meio' ? '<p class="cont" data-aviso></p>' : ''}
        <textarea aria-label="Texto: ${esc(t.nome)}"></textarea>
      </div></div>`).join('');
    freq.ord = '1º';
  }

  const mesRef = () => `${$('#fAnoSel').value}-${$('#fMesSel').value}`;
  function montarMeses() {
    if ($('#fAnoSel').options.length) return;
    const h = new Date(), a = h.getFullYear();
    $('#fMesSel').innerHTML = MESES.map((n, i) => `<option value="${String(i + 1).padStart(2, '0')}">${n[0].toUpperCase() + n.slice(1)}</option>`).join('');
    $('#fAnoSel').innerHTML = [a - 2, a - 1, a, a + 1].map(y => `<option>${y}</option>`).join('');
    $('#fMesSel').value = String(h.getMonth() + 1).padStart(2, '0'); $('#fAnoSel').value = a;
  }

  function ajustarMes() {
    const mes = mesRef(); if (!mes) return;
    const [y, m] = mes.split('-').map(Number), ult = isoData(new Date(y, m, 0)), hoje = isoData(new Date());
    $('#fData').min = `${mes}-01`; $('#fData').max = ult;
    if (!$('#fData').value || $('#fData').value < `${mes}-01` || $('#fData').value > ult)
      $('#fData').value = hoje >= `${mes}-01` && hoje <= ult ? hoje : `${mes}-01`;
    $('#fMesNome').textContent = `${MESES[m - 1]} de ${y}`;
    if (marcados().includes('meio')) atualizarOrdinal();
    carregarFreq();
  }

  async function carregarFreq() {
    const mes = mesRef(); if (!mes) return;
    const [y, m] = mes.split('-').map(Number);
    $('#fLista').innerHTML = '<p class="cont">Carregando…</p>';
    const dbClient = getDb();
    if (!dbClient) { $('#fLista').innerHTML = '<p class="msg-erro">Conexão indisponível.</p>'; return; }
    const { data, error } = await dbClient.from('frequencia_pm').select('*').eq('excluido', false)
      .gte('data', `${mes}-01`).lte('data', isoData(new Date(y, m, 0))).order('data').order('criado_em');
    if (mes !== mesRef()) return;
    if (error) { $('#fLista').innerHTML = '<p class="msg-erro">Erro ao carregar os lançamentos.</p>'; return; }
    freq.lista = data; listarFreq();
  }

  function listarFreq() {
    const f = $('#fFiltro').value;
    const ef = efetivoAtual();
    const todosPol = Object.values(ef).flat();
    const l = freq.lista.filter(r => todosPol.includes(r.policial) && (!f || r.policial === f));
    const dias = {};
    l.forEach(r => (dias[r.data] ||= []).push(r));
    $('#fLista').innerHTML = Object.keys(dias).sort().map(d => `<section class="fr-dia">
      <div class="fr-dia-cab"><b>${fmtData(d)} (${DIAS[dataLocal(d).getDay()]})</b><span>${dias[d].length} lançamento(s)</span></div>
      ${dias[d].map(r => `<div class="fr-item">
        <div class="fr-cab"><span class="tag">${esc(tipoFreq(r.tipo)?.nome || r.tipo)}</span><span class="cont">${esc(r.secao_efetivo)}</span></div>
        <p>${esc(r.texto)}</p>
        <div class="fr-acoes"><button class="mini" data-fe="${esc(r.id)}">Editar</button><button class="mini perigo" data-fx="${esc(r.id)}">Excluir</button></div></div>`).join('')}
    </section>`).join('') || '<p class="cont">Nenhum lançamento neste mês.</p>';
  }

  function garantirDialogs() {
    if (!$('#dFreq')) {
      document.body.insertAdjacentHTML('beforeend', `
        <dialog id="dFreq">
          <div class="topo"><h2 id="dFreqTitulo">Controle de Frequência</h2><button class="mini" data-fechar>Fechar</button></div>
          <div class="dupla"><label>Mês de referência<select id="fMesSel"></select></label><label>Ano<select id="fAnoSel"></select></label></div>
          <form id="fFreq" class="fr-form">
            <h3>Novo lançamento</h3>
            <div class="dupla">
              <label>Data<input type="date" id="fData" required></label>
              <label>Efetivo<select id="fPol" required></select></label>
            </div>
            <div id="fTipos"></div>
            <div class="acoes"><button class="btn">Registrar lançamento</button></div>
          </form>
          <div class="fr-topo">
            <h3>Lançamentos de <span id="fMesNome"></span></h3>
            <select id="fFiltro" aria-label="Filtrar por policial"></select>
          </div>
          <div id="fLista"></div>
        </dialog>
        <dialog id="dFreqEd">
          <form id="fFreqEd">
            <h2 id="feTitulo">Editar lançamento</h2>
            <label>Data<input type="date" id="feData" required></label>
            <label>Texto<textarea id="feTexto" required></textarea></label>
            <div class="acoes"><button type="button" class="btn ghost" data-fechar>Cancelar</button><button class="btn">Salvar alterações</button></div>
          </form>
        </dialog>
      `);
    }
  }

  function abrirFreq() {
    garantirDialogs();
    const sec = obterSecaoAtual();
    const secObj = (typeof SECOES !== 'undefined' && SECOES[sec]) ? SECOES[sec] : null;
    const nomeSec = secObj ? secObj.nome.split('·')[0].trim() : '';
    const t = $('#dFreqTitulo');
    if (t) t.textContent = sec === 'p3' ? 'Controle de Frequência' : `Controle de Frequência (${nomeSec})`;
    montarMeses();
    montarFormFreq(); 
    $('#fData').value = ''; 
    ajustarMes();
    $('#dFreq').showModal();
  }

  function inicializarEventos() {
    garantirDialogs();

    document.addEventListener('click', e => {
      if (e.target.closest('[data-freq]')) {
        abrirFreq();
      }
    });

    $('#fMesSel').onchange = $('#fAnoSel').onchange = ajustarMes;
    $('#fFiltro').onchange = listarFreq;

    $('#fTipos').addEventListener('change', e => {
      const c = e.target.closest('input[type=checkbox]'); if (!c) return;
      const bl = blocoFreq(c.value), ta = bl.querySelector('textarea');
      if (c.checked && !$('#fPol').value) { c.checked = false; return getAviso('Selecione o policial do efetivo primeiro.', 1); }
      bl.querySelector('.tp-corpo').hidden = !c.checked;
      if (!c.checked) return;
      delete ta.dataset.editado; atualizarTexto(c.value, true);
      if (c.value === 'meio') atualizarOrdinal();
      if (!matchMedia('(pointer:coarse)').matches) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
    });

    $('#fTipos').addEventListener('input', e => {
      const bl = e.target.closest('[data-t]'); if (!bl) return;
      if (e.target.tagName === 'TEXTAREA') e.target.dataset.editado = 1; else atualizarTexto(bl.dataset.t);
    });

    $('#fPol').onchange = () => {
      marcados().forEach(id => atualizarTexto(id));
      freq.pol = $('#fPol').value;
      if (marcados().includes('meio')) atualizarOrdinal();
    };

    $('#fData').onchange = () => { if (marcados().includes('meio')) atualizarOrdinal(); };

    $('#fFreq').onsubmit = async e => {
      e.preventDefault();
      const b = $('button.btn', e.target), data = $('#fData').value, pol = $('#fPol').value, ids = marcados();
      if (!pol) return getAviso('Selecione o policial do efetivo.', 1);
      if (!ids.length) return getAviso('Marque ao menos uma opção de lançamento.', 1);
      for (const id of ids) {
        const bl = blocoFreq(id);
        if (tipoFreq(id).horas && (!bl.querySelector('[name=ini]').value || !bl.querySelector('[name=fim]').value))
          return getAviso(`Informe o horário de início e de término em "${tipoFreq(id).nome}".`, 1);
        if (!bl.querySelector('textarea').value.trim()) return getAviso(`O texto de "${tipoFreq(id).nome}" está vazio.`, 1);
        if (/XXXX|'\.\.\.'/.test(bl.querySelector('textarea').value)) return getAviso(`Complete os trechos pendentes (XXXX ou '...') em "${tipoFreq(id).nome}".`, 1);
      }
      b.disabled = true;
      try {
        if (ids.includes('meio')) {
          const n = await contarMeios(pol, data);
          if (n >= 2) return getAviso('Este policial já tem 2 Meios Expedientes lançados nesta semana.', 1);
          if (`${n + 1}º` !== freq.ord) { await atualizarOrdinal(); atualizarTexto('meio', true); return getAviso('A numeração do Meio Expediente foi atualizada. Confira o texto e registre novamente.', 1); }
        }
        if (!await getConfirmarSenha(`Registrar ${ids.length} lançamento(s) de frequência de ${pol} em ${fmtData(data)}.`)) return;
        const u = getUsuario();
        const dbClient = getDb();
        const linhas = ids.map(id => ({ data, policial: pol, secao_efetivo: grupoDe(pol), tipo: id,
          texto: blocoFreq(id).querySelector('textarea').value.trim(), registrado_por: u ? u.email : '' }));
        const { error } = await dbClient.from('frequencia_pm').insert(linhas);
        if (error) throw error;
        getAviso('Lançamento registrado.');
        montarFormFreq(); $('#fPol').value = pol;
        carregarFreq();
      } catch (err) { console.error(err); getAviso('Não foi possível registrar. Verifique sua permissão.', 1); }
      finally { b.disabled = false; }
    };

    $('#fLista').addEventListener('click', async e => {
      const bEd = e.target.closest('[data-fe]'), bEx = e.target.closest('[data-fx]');
      if (!bEd && !bEx) return;
      const r = freq.lista.find(x => String(x.id) === (bEd || bEx).dataset[bEd ? 'fe' : 'fx']);
      if (!r) return;
      const nome = tipoFreq(r.tipo)?.nome || r.tipo, ref = `${nome} de ${r.policial} em ${fmtData(r.data)}`;
      if (bEd) {
        if (!await getConfirmarSenha(`Editar lançamento: ${ref}.`)) return;
        freq.editando = r;
        $('#feTitulo').textContent = `Editar: ${nome}`;
        $('#feData').value = r.data; $('#feTexto').value = r.texto;
        $('#dFreqEd').showModal();
      } else {
        if (!await getConfirmarSenha(`Excluir lançamento: ${ref}. O registro sai da lista e fica guardado no histórico.`)) return;
        const dbClient = getDb();
        const { error } = await dbClient.from('frequencia_pm').update({ excluido: true }).eq('id', r.id);
        if (error) return getAviso('Não foi possível excluir. Verifique sua permissão.', 1);
        getAviso('Lançamento excluído.'); carregarFreq();
      }
    });

    $('#fFreqEd').onsubmit = async e => {
      e.preventDefault();
      const dbClient = getDb();
      const { error } = await dbClient.from('frequencia_pm').update({ data: $('#feData').value, texto: $('#feTexto').value.trim() }).eq('id', freq.editando.id);
      if (error) return getAviso('Não foi possível salvar. Verifique sua permissão.', 1);
      $('#dFreqEd').close(); getAviso('Lançamento atualizado.'); carregarFreq();
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarEventos);
  } else {
    inicializarEventos();
  }

  window.abrirFreq = abrirFreq;
})();
