const STORAGE_KEY = "my-tasks";

const form = document.getElementById("task-form");
const input = document.getElementById("task-input");
const list = document.getElementById("task-list");
const emptyState = document.getElementById("empty-state");
const taskCount = document.getElementById("task-count");
const clearCompletedBtn = document.getElementById("clear-completed");
const filterButtons = document.querySelectorAll(".filter-btn");
const dateLabel = document.getElementById("date-label");

let tasks = loadTasks();
let currentFilter = "all";

dateLabel.textContent = new Date().toLocaleDateString(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
});

function loadTasks() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function render() {
  const visible = tasks.filter((task) => {
    if (currentFilter === "active") return !task.done;
    if (currentFilter === "completed") return task.done;
    return true;
  });

  list.innerHTML = "";

  for (const task of visible) {
    const li = document.createElement("li");
    li.className = "task-item" + (task.done ? " completed" : "");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = task.done;
    checkbox.setAttribute("aria-label", "Mark task as done");
    checkbox.addEventListener("change", () => toggleTask(task.id));

    const title = document.createElement("span");
    title.className = "title";
    title.textContent = task.title;

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.textContent = "✕";
    deleteBtn.setAttribute("aria-label", "Delete task");
    deleteBtn.addEventListener("click", () => deleteTask(task.id));

    li.append(checkbox, title, deleteBtn);
    list.appendChild(li);
  }

  emptyState.classList.toggle("hidden", visible.length > 0);
  if (tasks.length === 0) {
    emptyState.textContent = "No tasks yet — add one above! ✨";
  } else if (visible.length === 0) {
    emptyState.textContent =
      currentFilter === "completed"
        ? "Nothing completed yet — keep going! 💪"
        : "All done — nice work! 🎉";
  }

  const remaining = tasks.filter((t) => !t.done).length;
  taskCount.textContent = `${remaining} task${remaining === 1 ? "" : "s"} left`;

  const hasCompleted = tasks.some((t) => t.done);
  clearCompletedBtn.style.visibility = hasCompleted ? "visible" : "hidden";
}

function addTask(title) {
  tasks.unshift({ id: crypto.randomUUID(), title, done: false });
  saveTasks();
  render();
}

function toggleTask(id) {
  const task = tasks.find((t) => t.id === id);
  if (task) task.done = !task.done;
  saveTasks();
  render();
}

function deleteTask(id) {
  tasks = tasks.filter((t) => t.id !== id);
  saveTasks();
  render();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const title = input.value.trim();
  if (!title) return;
  addTask(title);
  input.value = "";
  input.focus();
});

clearCompletedBtn.addEventListener("click", () => {
  tasks = tasks.filter((t) => !t.done);
  saveTasks();
  render();
});

filterButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    filterButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentFilter = btn.dataset.filter;
    render();
  });
});

render();
