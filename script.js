document.addEventListener("DOMContentLoaded", () => {
  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  const toggle = document.querySelector(".menu-toggle");
  const nav = document.querySelector(".main-nav");
  if (toggle && nav) toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", open);
  });

  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const message = document.getElementById("loginMessage");
      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;
      if (!email || !password) return;
      // Protótipo: autenticação real será conectada ao Supabase na próxima etapa.
      localStorage.setItem("protegeLoggedIn", "true");
      message.textContent = "Acesso demonstrativo realizado. Abrindo painel...";
      setTimeout(() => window.location.href = "dashboard.html", 500);
    });
  }

  const logout = document.getElementById("logoutBtn");
  if (logout) logout.addEventListener("click", () => {
    localStorage.removeItem("protegeLoggedIn");
    window.location.href = "index.html";
  });

  // Wizard do atendimento
  const form = document.getElementById("attendanceForm");
  if (form) {
    let current = 1;
    const total = 10;
    const panels = [...document.querySelectorAll(".wizard-panel")];
    const steps = [...document.querySelectorAll(".wizard-step")];
    const counter = document.getElementById("stepCounter");
    const prev = document.getElementById("prevStep");
    const next = document.getElementById("nextStep");
    const save = document.getElementById("saveAttendance");
    const message = document.getElementById("saveMessage");

    function render() {
      panels.forEach(p => p.classList.toggle("active", Number(p.dataset.panel) === current));
      steps.forEach(s => s.classList.toggle("active", Number(s.dataset.step) === current));
      counter.textContent = `Passo ${current} de ${total}`;
      prev.disabled = current === 1;
      prev.style.opacity = current === 1 ? ".45" : "1";
      next.hidden = current === total;
      save.hidden = current !== total;
      window.scrollTo({top:0, behavior:"smooth"});
    }
    next.addEventListener("click", () => { if (current < total) { current++; render(); }});
    prev.addEventListener("click", () => { if (current > 1) { current--; render(); }});
    steps.forEach(s => s.addEventListener("click", () => { current = Number(s.dataset.step); render(); }));

    document.getElementById("addChild")?.addEventListener("click", () => {
      const tbody = document.querySelector("#childrenTable tbody");
      if (tbody.children.length >= 7) return alert("É possível cadastrar até 7 filhos.");
      const tr = document.createElement("tr");
      tr.innerHTML = `<td><input name="filho_nome[]"></td>
        <td><select name="filho_sexo[]"><option value="">Selecione</option><option>Feminino</option><option>Masculino</option><option>Outro</option></select></td>
        <td><input name="filho_idade[]" type="number" min="0" max="100"></td>
        <td><button type="button" class="small-btn remove-row">Excluir</button></td>`;
      tbody.appendChild(tr);
    });

    document.getElementById("addSession")?.addEventListener("click", () => {
      const tbody = document.querySelector("#sessionsTable tbody");
      const n = tbody.children.length + 1;
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${n}</td><td><input name="sessao_profissional[]"></td><td><input name="sessao_texto[]"></td><td><input name="sessao_observacoes[]"></td><td><input name="sessao_conclusao[]"></td>`;
      tbody.appendChild(tr);
    });

    form.addEventListener("click", e => {
      if (e.target.classList.contains("remove-row")) e.target.closest("tr").remove();
    });

    form.addEventListener("submit", e => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      localStorage.setItem("ultimoAtendimentoProtege", JSON.stringify(data));
      message.textContent = "Atendimento salvo no protótipo com sucesso. Na próxima etapa conectaremos este formulário ao banco de dados.";
      message.scrollIntoView({behavior:"smooth"});
    });

    render();
  }
});

// Cadastro de interesse dos pais/responsáveis
(() => {
  const form = document.getElementById("interestForm");
  if (!form) return;

  const rows = document.getElementById("interestChildren");
  const add = document.getElementById("addInterestChild");
  const message = document.getElementById("interestMessage");

  function updateRemoveButtons() {
    const buttons = rows.querySelectorAll(".remove-child");
    buttons.forEach(btn => btn.disabled = buttons.length === 1);
  }

  add?.addEventListener("click", () => {
    const row = document.createElement("div");
    row.className = "child-row";
    row.innerHTML = `
      <label><span class="mobile-label">Nome do filho(a)</span><input name="childName[]" type="text" required placeholder="Nome"></label>
      <label><span class="mobile-label">Idade</span><input name="childAge[]" type="number" required min="0" max="99" placeholder="Idade"></label>
      <button class="small-btn remove-child" type="button" aria-label="Excluir filho">Excluir</button>`;
    rows.appendChild(row);
    updateRemoveButtons();
    row.querySelector("input")?.focus();
  });

  rows.addEventListener("click", e => {
    const button = e.target.closest(".remove-child");
    if (!button || button.disabled) return;
    button.closest(".child-row").remove();
    updateRemoveButtons();
  });

  form.addEventListener("submit", e => {
    e.preventDefault();
    if (!form.reportValidity()) return;

    const fd = new FormData(form);
    const names = fd.getAll("childName[]");
    const ages = fd.getAll("childAge[]");
    const children = names.map((name, i) => `• ${name} — ${ages[i]} ano(s)`).join("\n");

    const address = [
      `${fd.get("logradouro")}, ${fd.get("numero")}`,
      fd.get("complemento") ? `Complemento: ${fd.get("complemento")}` : "",
      `${fd.get("bairro")} — ${fd.get("cidade")}/${String(fd.get("estado")).toUpperCase()}`,
      `CEP: ${fd.get("cep")}`
    ].filter(Boolean).join("\n");

    const text = `Olá, equipe Protege! Gostaria de cadastrar meu interesse no programa.\n\n` +
      `*PAIS / RESPONSÁVEIS*\n` +
      `Responsável 1: ${fd.get("responsavel1")}\n` +
      `Telefone/WhatsApp: ${fd.get("telefone")}\n` +
      (fd.get("email") ? `E-mail: ${fd.get("email")}\n` : "") +
      (fd.get("responsavel2") ? `Responsável 2: ${fd.get("responsavel2")}\n` : "") +
      `\n*FILHOS*\n${children}\n\n` +
      `*ENDEREÇO*\n${address}`;

    const url = `https://wa.me/5511965980606?text=${encodeURIComponent(text)}`;
    message.textContent = "Cadastro preparado. O WhatsApp será aberto para você confirmar o envio.";
    window.open(url, "_blank", "noopener");
  });

  updateRemoveButtons();
})();
