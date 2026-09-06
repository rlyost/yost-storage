(function () {
  var panel = document.getElementById("calculator");
  var launcher = document.getElementById("calc-link");
  var display = document.getElementById("calc-display");
  var keys = document.getElementById("calc-keys");
  var current = "0";
  var accumulator = null;
  var operation = null;
  var replace = true;

  function render() { display.textContent = current; }

  function reset() {
    current = "0";
    accumulator = null;
    operation = null;
    replace = true;
    render();
  }

  function format(value) {
    if (!Number.isFinite(value)) return "Error";
    return String(Number(value.toPrecision(12)));
  }

  function calculate(left, op, right) {
    if (op === "+") return left + right;
    if (op === "-") return left - right;
    if (op === "*") return left * right;
    if (op === "/") return right === 0 ? NaN : left / right;
    return right;
  }

  function digit(value) {
    if (current === "Error" || replace) {
      current = value;
      replace = false;
    } else if (current.replace("-", "").replace(".", "").length < 12) {
      current = current === "0" ? value : current + value;
    }
    render();
  }

  function decimal() {
    if (current === "Error" || replace) {
      current = "0.";
      replace = false;
    } else if (current.indexOf(".") === -1) {
      current += ".";
    }
    render();
  }

  function chooseOperation(next) {
    var value = Number(current);
    if (current === "Error") { reset(); return; }
    if (operation && !replace) {
      value = calculate(accumulator, operation, value);
      current = format(value);
      render();
    }
    accumulator = value;
    operation = next;
    replace = true;
  }

  function equals() {
    if (!operation || current === "Error") return;
    current = format(calculate(accumulator, operation, Number(current)));
    accumulator = null;
    operation = null;
    replace = true;
    render();
  }

  function action(name) {
    if (name === "clear") reset();
    else if (name === "decimal") decimal();
    else if (name === "equals") equals();
    else if (name === "sign" && current !== "0" && current !== "Error") {
      current = current.charAt(0) === "-" ? current.slice(1) : "-" + current;
      render();
    } else if (name === "percent" && current !== "Error") {
      current = format(Number(current) / 100);
      replace = true;
      render();
    }
  }

  function open() {
    panel.show();
    launcher.setAttribute("aria-expanded", "true");
    panel.querySelector("button").focus();
  }

  function close() {
    panel.close();
    launcher.setAttribute("aria-expanded", "false");
    launcher.focus();
  }

  launcher.addEventListener("click", function () {
    if (panel.open) close(); else open();
  });
  document.getElementById("calc-close").addEventListener("click", close);
  keys.addEventListener("click", function (event) {
    var button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.digit) digit(button.dataset.digit);
    else if (button.dataset.operation) chooseOperation(button.dataset.operation);
    else action(button.dataset.action);
  });

  document.addEventListener("keydown", function (event) {
    if (!panel.open || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
    if (/^[0-9]$/.test(event.key)) digit(event.key);
    else if (event.key === "." || event.key === ",") decimal();
    else if (/^[+\-*/]$/.test(event.key)) chooseOperation(event.key);
    else if (event.key === "Enter" || event.key === "=") equals();
    else if (event.key === "%") action("percent");
    else if (event.key === "Escape") close();
    else if (event.key === "Backspace") {
      current = current.length > 1 ? current.slice(0, -1) : "0";
      render();
    } else return;
    event.preventDefault();
  });
})();
