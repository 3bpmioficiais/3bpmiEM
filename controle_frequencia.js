/**
 * controle_frequencia.js - Módulo de Controle de Frequência e Extração de Relatório Word
 * 3º Batalhão de Caçadores
 */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  
  const getDb = () => window.db || (typeof db !== 'undefined' ? db : null);
  const getAviso = (msg, erro) => {
    if (typeof aviso === 'function') aviso(msg, erro);
    else if (typeof window.aviso === 'function') window.aviso(msg, erro);
    else alert(msg);
  };

  function obterSecaoAtual() {
    return window.secaoAtual || 
           (typeof secaoAtual !== 'undefined' ? secaoAtual : '') || 
           document.querySelector('#abas [aria-current="true"]')?.dataset.aba || 
           location.hash.slice(1) || 
           'p3';
  }

  // Nomes dos policiais para o controle
  const POLICIAIS_PADRAO = [
    'Ten Cel PM Eduardo', 'Maj PM Martins Ribeiro', 'Maj PM Luana', 'Cap PM Cravero', 'Cap PM Del Vecchio',
    'Cap PM André Luís', 'Ten PM Felipe Carvalho', 'Ten PM Ribeiro', 'Ten PM Feitosa', 'Ten PM Natalia',
    'Ten PM Derick', 'Ten PM Chevchuk', 'Ten PM Zanardo', 'Ten PM Larissa Muniz', 'Ten PM Borgo'
  ];

  function garantirDialogFreq() {
    let diag = $('#dFreq');
    if (!diag) {
      // Cria o dialog de controle de frequência caso não exista na página principal
      const html = `
        <dialog id="dFreq">
          <div class="topo">
            <h2 id="dFreqTitulo">Controle de Frequência</h2>
            <button class="mini" data-fechar>Fechar</button>
          </div>
          <div class="dupla">
            <label>Mês de referência<select id="fMesSel"></select></label>
            <label>Ano<select id="fAnoSel"></select></label>
          </div>
          
          <div style="margin: 15px 0; display: flex; justify-content: flex-end;">
            <button type="button" class="btn" id="btnExtrairRelatorio" style="background: #2ed573; color: #fff; font-weight: 700;">
              📄 Extrair Relatório (.doc)
            </button>
          </div>

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
      `;
      document.body.insertAdjacentHTML('beforeend', html);
      diag = $('#dFreq');
    }
  }

  // Função para gerar e baixar o relatório em Word (.doc) exatamente nos moldes solicitados
  async function extrairRelatorioWord() {
    const mesSel = parseInt($('#fMesSel')?.value || new Date().getMonth(), 10);
    const anoSel = parseInt($('#fAnoSel')?.value || new Date().getFullYear(), 10);
    
    // Descobre o total de dias do mês selecionado (seguindo a regra de dias que realmente existem em cada mês)
    const ultimoDia = new Date(anoSel, mesSel + 1, 0).getDate();
    
    const secaoSigla = obterSecaoAtual().toUpperCase();
    // Exemplo de formatação da seção solicitada: "EM-P/3", "EM-P/1", "EM-SPJMD", etc.
    const nomeSecaoFormatado = `EM-${secaoSigla === 'SJD' ? 'SPJMD' : secaoSigla}`;

    const mesesNomes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const mesNomeStr = mesesNomes[mesSel].toUpperCase();

    // Cabeçalhos dos dias dinâmicos (01 até o último dia do mês)
    let cabecalhosDiasHtml = '';
    for (let d = 1; d <= ultimoDia; d++) {
      const diaStr = String(d).padStart(2, '0');
      cabecalhosDiasHtml += `<th style="border: 1px solid #000; padding: 4px; font-size: 9pt; text-align: center; background-color: #f2f2f2;">${diaStr}${mesNomeStr.slice(0,3)}${String(anoSel).slice(-2)}</th>`;
    }

    // Montagem do conteúdo HTML estruturado para o arquivo .doc (compatível com Word)
    const conteudoHtml = `
      <!DOCTYPE html>
      <html>
      <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: 'Times New Roman', Times, serif; font-size: 10pt; color: #000; }
        .cabecalho-institucional { text-align: center; font-weight: bold; margin-bottom: 15px; }
        .titulo-alteracao { text-align: center; font-weight: bold; font-size: 11pt; margin: 20px 0; text-transform: uppercase; }
        table { border-collapse: collapse; width: 100%; margin-top: 10px; }
        th, td { border: 1px solid #000; padding: 5px; text-align: center; font-size: 8pt; }
        .assinaturas { margin-top: 40px; text-align: center; width: 100%; }
      </style>
      </head>
      <body>
        <div class="cabecalho-institucional">
          SECRETARIA DA SEGURANÇA PÚBLICA<br>
          POLÍCIA MILITAR DO ESTADO DE SÃO PAULO<br>
          COMANDO DE POLICIAMENTO DO INTERIOR TRÊS - 3º BPM/I
        </div>

        <div class="titulo-alteracao">
          ALTERAÇÕES NA ESCALA DE SERVIÇO ADMINISTRATIVO "${nomeSecaoFormatado}"<br>
          DE: 01 A ${String(ultimoDia).padStart(2, '0')}${mesornamentar = mesNomeStr.slice(0,3)}${String(anoSel).slice(-2)}
        </div>

        <table>
          <thead>
            <tr>
              <th style="border: 1px solid #000; padding: 5px; background: #ddd;">POLICIAL MILITAR</th>
              ${cabecalhosDiasHtml}
            </tr>
          </thead>
          <tbody>
            <!-- Linhas de exemplificação de registros de folga, inversão e aglutinação lançados nos respectivos dias -->
            <tr>
              <td style="text-align: left; padding-left: 5px; font-weight: bold;">Exemplo / Efetivo da Seção</td>
              ${Array.from({length: ultimoDia}, (_, i) => `<td style="font-size: 7pt;">${i === 4 ? 'FOLGA' : (i === 12 ? 'INV.' : '')}</td>`).join('')}
            </tr>
          </tbody>
        </table>

        <br><br>
        <p>Quartel em Ribeirão Preto, 01 de ${mesesNomes[mesSel].toLowerCase()} de ${anoSel}.</p>
        
        <div class="assinaturas">
          <br><br>
          ___________________________________________________<br>
          <b>FRANCISCO REGIS CRAVERO - Cap PM</b><br>
          Chefe da Seção de Operações
        </div>
      </body>
      </html>
    `;

    // Aciona o download do arquivo .doc gerado
    const blob = new Blob(['\ufeff' + conteudoHtml], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Escala_${nomeSecaoFormatado}_${mesesNomes[mesSel]}_${anoSel}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    getAviso('Relatório em Word (.doc) extraído com sucesso!');
  }

  function inicializarControleFrequencia() {
    document.addEventListener('click', e => {
      const btn = e.target.closest('[data-freq]');
      if (btn) {
        garantirDialogFreq();
        const dFreq = $('#dFreq');
        if (dFreq) {
          dFreq.showModal();
          
          // Preenche seletores de Meses e Anos caso estejam vazios
          const mesSel = $('#fMesSel');
          const anoSel = $('#fAnoSel');
          if (mesSel && mesSel.options.length === 0) {
            const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
            mesSel.innerHTML = meses.map((m, idx) => `<option value="${idx}" ${idx === new Date().getMonth() ? 'selected' : ''}>${m}</option>`).join('');
          }
          if (anoSel && anoSel.options.length === 0) {
            const anoAtual = new Date().getFullYear();
            anoSel.innerHTML = [anoAtual, anoAtual - 1, anoAtual + 1].map(y => `<option value="${y}" ${y === anoAtual ? 'selected' : ''}>${y}</option>`).join('');
          }

          // Vincula o evento do botão de extrair relatório
          const btnExtrair = $('#btnExtrairRelatorio');
          if (btnExtrair) {
            btnExtrair.onclick = extrairRelatorioWord;
          }
        }
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarControleFrequencia);
  } else {
    inicializarControleFrequencia();
  }
})();
