// alert.js - Component alert/notification
function showAlert(message, type = "info", timeout = 5000) {
  let container = document.getElementById("alert-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "alert-container";
    container.style.position = "fixed";
    container.style.top = "20px";
    container.style.right = "20px";
    container.style.zIndex = "1050";
    container.style.width = "320px";
    document.body.appendChild(container);
  }

  const wrapper = document.createElement("div");
  wrapper.className = `alert alert-${type} alert-dismissible fade show`;
  wrapper.role = "alert";
  wrapper.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;

  container.appendChild(wrapper);

  if (timeout) {
    setTimeout(() => {
      wrapper.classList.remove("show");
      wrapper.addEventListener("transitionend", () => wrapper.remove());
    }, timeout);
  }
}