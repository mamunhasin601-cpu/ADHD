const mockUser = { timeFormat: "H24" as "H24" | "H12" };
jest.mock("../stores/auth.store", () => ({
  useAuthStore: (selector: any) => selector({ user: mockUser }),
}));
import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import type { Task } from "@focus/shared-types";
import { NowCard } from "./NowCard";

const task: Task = {
  id: "task-1", userId: "user-1", title: "Подготовить один слайд",
  startTime: new Date("2026-08-12T14:30:00.000Z"), durationMinutes: 30,
  color: "#6B5BFC", isRecurring: false, recurrenceRule: null, parentTaskId: null,
  completedAt: null, startedAt: null, firstStep: null, createdAt: new Date(), updatedAt: new Date(),
};
const props = { onStart: jest.fn(), onComplete: jest.fn(), onOpenTask: jest.fn(), onSaveFirstStep: jest.fn() };

describe("NowCard regressions", () => {
  beforeEach(() => { jest.clearAllMocks(); mockUser.timeFormat = "H24"; process.env.TZ = "UTC"; });

  it("shows known and honest unknown duration without fabricating zero", () => {
    const { rerender } = render(<NowCard task={task} mode="current" {...props} />);
    expect(screen.getByText(/около 30 мин/)).toBeTruthy();
    rerender(<NowCard task={{ ...task, durationMinutes: null }} mode="current" {...props} />);
    expect(screen.getByText(/Длительность: Не знаю/)).toBeTruthy();
    expect(screen.queryByText(/около 0 мин/)).toBeNull();
  });

  it("keeps plan editing as a secondary action with the exact task", () => {
    render(<NowCard task={task} mode="current" {...props} />);
    fireEvent.press(screen.getByText("Изменить план"));
    expect(props.onOpenTask).toHaveBeenCalledTimes(1);
    expect(props.onOpenTask).toHaveBeenCalledWith(task);
  });

  it("formats H24/H12 without mutating or reinterpreting the supplied instant", () => {
    const instant = new Date(task.startTime!); const before = instant.getTime();
    const { rerender } = render(<NowCard task={{ ...task, startTime: instant }} mode="upcoming" {...props} />);
    expect(screen.getByText(/14:30/)).toBeTruthy();
    mockUser.timeFormat = "H12";
    rerender(<NowCard task={{ ...task, startTime: instant }} mode="upcoming" {...props} />);
    expect(screen.getByText(/2:30.*PM/i)).toBeTruthy();
    expect(instant.getTime()).toBe(before);
    expect(task.startTime).toEqual(new Date("2026-08-12T14:30:00.000Z"));
  });
});

describe("NowCard explicit start", () => {
  beforeEach(() => jest.clearAllMocks());
  it.each([
    ["current", "Запланировано сейчас"], ["upcoming", "Ближайшее действие"],
  ] as const)("offers one explicit start for an unstarted %s task", (mode, context) => {
    render(<NowCard task={task} mode={mode} {...props} />);
    expect(screen.getByText(context)).toBeTruthy();
    expect(screen.getByText("Начать")).toBeTruthy();
    expect(screen.queryByText("Завершить")).toBeNull();
    fireEvent.press(screen.getByText("Начать"));
    expect(props.onStart).toHaveBeenCalledTimes(1);
    expect(props.onStart).toHaveBeenCalledWith(task.id);
  });

  it("disables start and secondary actions with busy accessibility while starting", () => {
    render(<NowCard task={task} mode="current" {...props} isStarting />);
    const start = screen.getByRole("button", { name: `Начать задачу ${task.title}` });
    const edit = screen.getByRole("button", { name: `Изменить задачу ${task.title}` });
    expect(screen.getByText("Начинаю…")).toBeTruthy();
    expect(start).toBeDisabled(); expect(edit).toBeDisabled();
    expect(start.props.accessibilityState).toEqual({ disabled: true, busy: true });
    expect(edit.props.accessibilityState).toEqual({ disabled: true });
  });

  it("shows confirmed start and delegates completion", () => {
    render(<NowCard task={{ ...task, startedAt: new Date("2026-08-12T14:31:07Z") }} mode="current" {...props} />);
    expect(screen.getByText("Начато")).toBeTruthy();
    fireEvent.press(screen.getByText("Завершить"));
    expect(props.onComplete).toHaveBeenCalledTimes(1);
    expect(props.onComplete).toHaveBeenCalledWith(task.id);
  });

  it("completion pending disables completion and plan editing", () => {
    render(<NowCard task={{ ...task, startedAt: new Date() }} mode="current" {...props} isCompleting />);
    expect(screen.getByText("Сохраняю…")).toBeDisabled();
    expect(screen.getByText("Изменить план")).toBeDisabled();
  });

  it("exposes a calm start error as an alert", () => {
    render(<NowCard task={task} mode="current" {...props} startError="Проверьте соединение и попробуйте снова." />);
    expect(screen.getByRole("alert")).toHaveTextContent("Проверьте соединение и попробуйте снова.");
  });
});

describe("NowCard difficult start", () => {
  beforeEach(() => jest.clearAllMocks());
  it("opens without mutation and saves a user-authored step without starting", async () => {
    const onSaveFirstStep = jest.fn().mockResolvedValue({ ...task, firstStep: "Открыть документ" });
    render(<NowCard task={task} mode="current" {...props} onSaveFirstStep={onSaveFirstStep} />);
    fireEvent.press(screen.getByText("Мне трудно начать"));
    expect(onSaveFirstStep).not.toHaveBeenCalled();
    expect(props.onStart).not.toHaveBeenCalled();
    const save = screen.getByText("Сохранить маленький шаг");
    expect(save).toBeDisabled();
    fireEvent.changeText(screen.getByLabelText("Первый маленький шаг"), "  Открыть документ  ");
    fireEvent.press(screen.getByText("Сохранить маленький шаг"));
    await waitFor(() => expect(screen.getByText("Открыть документ")).toBeTruthy());
    expect(onSaveFirstStep).toHaveBeenCalledWith(task.id, "Открыть документ");
    expect(props.onStart).not.toHaveBeenCalled();
  });

  it("guards two immediate modal starts and closes only on canonical start", async () => {
    let resolve!: () => void;
    const onStart = jest.fn(() => new Promise<void>((done) => { resolve = done; }));
    const startedTask = { ...task, firstStep: "Открыть документ" };
    const view = render(<NowCard task={startedTask} mode="current" {...props} onStart={onStart} />);
    fireEvent.press(screen.getByText("Мне трудно начать"));
    const start = screen.getByText("Начать с этого шага");
    fireEvent.press(start); fireEvent.press(start);
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Начинаю…")).toBeDisabled();
    expect(screen.getByText("Открыть документ")).toBeTruthy();
    await act(async () => resolve());
    expect(screen.getByText("Начать с этого шага")).toBeTruthy();
    view.rerender(<NowCard task={{ ...startedTask, startedAt: new Date("2026-08-14T10:20:00Z") }} mode="current" {...props} onStart={onStart} />);
    await waitFor(() => expect(screen.queryByText("Начать с малого")).toBeNull());
    expect(screen.getByText("Начато")).toBeTruthy();
    expect(screen.queryByText("Мне трудно начать")).toBeNull();
  });

  it("shows a persisted step and delegates its explicit start", async () => {
    render(<NowCard task={{ ...task, firstStep: "Открыть документ" }} mode="current" {...props} />);
    fireEvent.press(screen.getByText("Мне трудно начать"));
    expect(screen.getByText("Открыть документ")).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByText("Начать с этого шага")));
    expect(props.onStart).toHaveBeenCalledTimes(1);
    expect(props.onStart).toHaveBeenCalledWith(task.id);
  });

  it("guards rapid saves, exposes pending state, and shows the exact canonical response", async () => {
    let resolve!: (value: Task) => void;
    const onSaveFirstStep = jest.fn(() => new Promise<Task>((done) => { resolve = done; }));
    render(<NowCard task={task} mode="current" {...props} onSaveFirstStep={onSaveFirstStep} />);
    fireEvent.press(screen.getByText("Мне трудно начать"));
    fireEvent.changeText(screen.getByLabelText("Первый маленький шаг"), "Черновик");
    const save = screen.getByText("Сохранить маленький шаг");
    fireEvent.press(save); fireEvent.press(save);
    expect(onSaveFirstStep).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Сохраняю…")).toBeDisabled();
    expect(screen.getByLabelText("Первый маленький шаг")).toBeDisabled();
    expect(screen.getByText("Начать")).toBeDisabled();
    expect(screen.getByText("Изменить план")).toBeDisabled();
    expect(screen.getByRole("button", { name: `Помощь с началом задачи ${task.title}` })).toBeDisabled();
    expect(screen.getByLabelText("Закрыть помощь с началом")).not.toBeDisabled();
    await act(async () => resolve({ ...task, firstStep: "Канонический шаг" }));
    expect(screen.getByText("Канонический шаг")).toBeTruthy();
    expect(props.onStart).not.toHaveBeenCalled();
  });

  it("retains the exact draft on failure, clears the alert on retry, and supports editing", async () => {
    const onSaveFirstStep = jest.fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ ...task, firstStep: "Ответ сервера" });
    render(<NowCard task={{ ...task, firstStep: "Старый шаг" }} mode="current" {...props} onSaveFirstStep={onSaveFirstStep} />);
    fireEvent.press(screen.getByText("Мне трудно начать"));
    fireEvent.press(screen.getByText("Изменить маленький шаг"));
    fireEvent.changeText(screen.getByLabelText("Первый маленький шаг"), "  Мой черновик  ");
    fireEvent.press(screen.getByText("Сохранить маленький шаг"));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/Не удалось сохранить шаг/));
    expect(screen.getByDisplayValue("  Мой черновик  ")).toBeTruthy();
    expect(props.onStart).not.toHaveBeenCalled();
    fireEvent.press(screen.getByText("Сохранить маленький шаг"));
    await waitFor(() => expect(screen.getByText("Ответ сервера")).toBeTruthy());
    expect(screen.queryByRole("alert")).toBeNull();
    expect(onSaveFirstStep).toHaveBeenNthCalledWith(1, task.id, "Мой черновик");
    expect(onSaveFirstStep).toHaveBeenNthCalledWith(2, task.id, "Мой черновик");
  });

  it("is keyboard-safe and resets modal, draft, and error across task contexts", async () => {
    const onSaveFirstStep = jest.fn().mockRejectedValue(new Error("offline"));
    const taskA = { ...task, firstStep: "Шаг A" };
    const taskB = { ...task, id: "task-2", title: "Задача B", firstStep: "Шаг B" };
    const view = render(<NowCard task={taskA} mode="current" {...props} onSaveFirstStep={onSaveFirstStep} />);
    fireEvent.press(screen.getByText("Мне трудно начать"));
    expect(screen.getByTestId("difficult-start-keyboard-view")).toBeTruthy();
    expect(screen.getByTestId("difficult-start-scroll-view").props.keyboardShouldPersistTaps).toBe("handled");
    fireEvent.press(screen.getByText("Изменить маленький шаг"));
    fireEvent.changeText(screen.getByLabelText("Первый маленький шаг"), "Ошибка A");
    fireEvent.press(screen.getByText("Сохранить маленький шаг"));
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    view.rerender(<NowCard task={taskB} mode="current" {...props} onSaveFirstStep={onSaveFirstStep} />);
    await waitFor(() => expect(screen.queryByText("Начать с малого")).toBeNull());
    expect(screen.queryByText("Ошибка A")).toBeNull();
    fireEvent.press(screen.getByText("Мне трудно начать"));
    expect(screen.getByText("Шаг B")).toBeTruthy();
    view.rerender(<NowCard task={taskA} mode="current" {...props} onSaveFirstStep={onSaveFirstStep} />);
    await waitFor(() => expect(screen.queryByText("Начать с малого")).toBeNull());
    fireEvent.press(screen.getByText("Мне трудно начать"));
    expect(screen.getByText("Шаг A")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("does not offer difficult-start support after start", () => {
    render(<NowCard task={{ ...task, startedAt: new Date() }} mode="current" {...props} />);
    expect(screen.queryByText("Мне трудно начать")).toBeNull();
  });

  it("does not offer difficult-start support after completion", () => {
    render(<NowCard task={{ ...task, completedAt: new Date() }} mode="current" {...props} />);
    expect(screen.queryByText("Мне трудно начать")).toBeNull();
  });

  it("closes an open support surface on canonical completion", async () => {
    const completedTask = { ...task, firstStep: "Открыть документ" };
    const view = render(<NowCard task={completedTask} mode="current" {...props} />);
    fireEvent.press(screen.getByText("Мне трудно начать"));
    expect(screen.getByText("Начать с малого")).toBeTruthy();
    view.rerender(<NowCard task={{ ...completedTask, completedAt: new Date() }} mode="current" {...props} />);
    await waitFor(() => expect(screen.queryByText("Начать с малого")).toBeNull());
    expect(screen.queryByText("Начать с этого шага")).toBeNull();
    expect(screen.queryByText("Мне трудно начать")).toBeNull();
  });

  it("clears invalidated save pending on canonical start and ignores its late resolution", async () => {
    let resolveSave!: (value: Task) => void;
    const onSaveFirstStep = jest.fn(() => new Promise<Task>((resolve) => { resolveSave = resolve; }));
    const view = render(<NowCard task={task} mode="current" {...props} onSaveFirstStep={onSaveFirstStep} />);
    fireEvent.press(screen.getByText("Мне трудно начать"));
    fireEvent.changeText(screen.getByLabelText("Первый маленький шаг"), "Старый черновик");
    fireEvent.press(screen.getByText("Сохранить маленький шаг"));
    expect(screen.getByText("Сохраняю…")).toBeDisabled();

    view.rerender(<NowCard task={{ ...task, startedAt: new Date("2026-08-14T12:00:00Z") }} mode="current" {...props} onSaveFirstStep={onSaveFirstStep} />);
    await waitFor(() => expect(screen.queryByText("Начать с малого")).toBeNull());
    expect(screen.getByText("Начато")).toBeTruthy();
    expect(screen.getByText("Завершить")).not.toBeDisabled();

    await act(async () => resolveSave({ ...task, firstStep: "Устаревший ответ" }));
    expect(screen.queryByText("Устаревший ответ")).toBeNull();
    expect(screen.getByText("Завершить")).not.toBeDisabled();
  });

  it("clears invalidated save pending on canonical completion and ignores its late rejection", async () => {
    let rejectSave!: (error: Error) => void;
    const onSaveFirstStep = jest.fn(() => new Promise<Task>((_resolve, reject) => { rejectSave = reject; }));
    const view = render(<NowCard task={task} mode="current" {...props} onSaveFirstStep={onSaveFirstStep} />);
    fireEvent.press(screen.getByText("Мне трудно начать"));
    fireEvent.changeText(screen.getByLabelText("Первый маленький шаг"), "Черновик до завершения");
    fireEvent.press(screen.getByText("Сохранить маленький шаг"));

    view.rerender(<NowCard task={{ ...task, completedAt: new Date("2026-08-14T12:05:00Z") }} mode="current" {...props} onSaveFirstStep={onSaveFirstStep} />);
    await waitFor(() => expect(screen.queryByText("Начать с малого")).toBeNull());
    expect(screen.getByText("Изменить план")).not.toBeDisabled();
    await act(async () => rejectSave(new Error("late failure")));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText("Черновик до завершения")).toBeNull();
    expect(screen.getByText("Изменить план")).not.toBeDisabled();
  });

  it("remains mounted and saves when rendered inside React StrictMode", async () => {
    const onSaveFirstStep = jest.fn().mockResolvedValue({ ...task, firstStep: "StrictMode шаг" });
    render(<React.StrictMode><NowCard task={task} mode="current" {...props} onSaveFirstStep={onSaveFirstStep} /></React.StrictMode>);
    fireEvent.press(screen.getByText("Мне трудно начать"));
    fireEvent.changeText(screen.getByLabelText("Первый маленький шаг"), "StrictMode draft");
    fireEvent.press(screen.getByText("Сохранить маленький шаг"));
    await waitFor(() => expect(screen.getByText("StrictMode шаг")).toBeTruthy());
    expect(onSaveFirstStep).toHaveBeenCalledTimes(1);
  });

  it("ignores stale task A save resolution while task B remains pending and guarded", async () => {
    let resolveA!: (value: Task) => void;
    let resolveB!: (value: Task) => void;
    const taskA = { ...task, id: "task-a", title: "Задача A" };
    const taskB = { ...task, id: "task-b", title: "Задача B" };
    const onSaveFirstStep = jest.fn((id: string) => new Promise<Task>((resolve) => {
      if (id === taskA.id) resolveA = resolve;
      else resolveB = resolve;
    }));
    const view = render(<NowCard task={taskA} mode="current" {...props} onSaveFirstStep={onSaveFirstStep} />);
    fireEvent.press(screen.getByText("Мне трудно начать"));
    fireEvent.changeText(screen.getByLabelText("Первый маленький шаг"), "Черновик A");
    fireEvent.press(screen.getByText("Сохранить маленький шаг"));

    view.rerender(<NowCard task={taskB} mode="current" {...props} onSaveFirstStep={onSaveFirstStep} />);
    fireEvent.press(screen.getByText("Мне трудно начать"));
    fireEvent.changeText(screen.getByLabelText("Первый маленький шаг"), "Черновик B");
    fireEvent.press(screen.getByText("Сохранить маленький шаг"));
    expect(onSaveFirstStep).toHaveBeenCalledTimes(2);

    await act(async () => resolveA({ ...taskA, firstStep: "Канонический шаг A" }));
    expect(screen.queryByText("Канонический шаг A")).toBeNull();
    expect(screen.getByText("Сохраняю…")).toBeDisabled();
    fireEvent.press(screen.getByText("Сохраняю…"));
    expect(onSaveFirstStep).toHaveBeenCalledTimes(2);

    await act(async () => resolveB({ ...taskB, firstStep: "Канонический шаг B" }));
    expect(screen.getByText("Канонический шаг B")).toBeTruthy();
    expect(screen.queryByText("Канонический шаг A")).toBeNull();
  });

  it("ignores stale task A save rejection and lets task B save successfully", async () => {
    let rejectA!: (error: Error) => void;
    const taskA = { ...task, id: "task-a", title: "Задача A" };
    const taskB = { ...task, id: "task-b", title: "Задача B" };
    const onSaveFirstStep = jest.fn((id: string) => id === taskA.id
      ? new Promise<Task>((_resolve, reject) => { rejectA = reject; })
      : Promise.resolve({ ...taskB, firstStep: "Канонический шаг B" }));
    const view = render(<NowCard task={taskA} mode="current" {...props} onSaveFirstStep={onSaveFirstStep} />);
    fireEvent.press(screen.getByText("Мне трудно начать"));
    fireEvent.changeText(screen.getByLabelText("Первый маленький шаг"), "Ошибка A");
    fireEvent.press(screen.getByText("Сохранить маленький шаг"));
    view.rerender(<NowCard task={taskB} mode="current" {...props} onSaveFirstStep={onSaveFirstStep} />);

    await act(async () => rejectA(new Error("offline A")));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText("Ошибка A")).toBeNull();
    fireEvent.press(screen.getByText("Мне трудно начать"));
    fireEvent.changeText(screen.getByLabelText("Первый маленький шаг"), "Черновик B");
    fireEvent.press(screen.getByText("Сохранить маленький шаг"));
    await waitFor(() => expect(screen.getByText("Канонический шаг B")).toBeTruthy());
  });

  it("ignores stale task A start completion while task B remains pending and guarded", async () => {
    let resolveA!: () => void;
    let resolveB!: () => void;
    const taskA = { ...task, id: "task-a", title: "Задача A", firstStep: "Шаг A" };
    const taskB = { ...task, id: "task-b", title: "Задача B", firstStep: "Шаг B" };
    const onStart = jest.fn((id: string) => new Promise<void>((resolve) => {
      if (id === taskA.id) resolveA = resolve;
      else resolveB = resolve;
    }));
    const view = render(<NowCard task={taskA} mode="current" {...props} onStart={onStart} />);
    fireEvent.press(screen.getByText("Мне трудно начать"));
    fireEvent.press(screen.getByText("Начать с этого шага"));
    view.rerender(<NowCard task={taskB} mode="current" {...props} onStart={onStart} />);
    fireEvent.press(screen.getByText("Мне трудно начать"));
    fireEvent.press(screen.getByText("Начать с этого шага"));
    expect(onStart).toHaveBeenCalledTimes(2);

    await act(async () => resolveA());
    const startB = screen.getByRole("button", { name: "Начать с маленького шага задачу Задача B" });
    expect(startB).toBeDisabled();
    fireEvent.press(startB);
    expect(onStart).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Шаг B")).toBeTruthy();

    await act(async () => resolveB());
    view.rerender(<NowCard task={{ ...taskB, startedAt: new Date("2026-08-14T11:00:00Z") }} mode="current" {...props} onStart={onStart} />);
    await waitFor(() => expect(screen.queryByText("Начать с малого")).toBeNull());
    expect(screen.getByText("Начато")).toBeTruthy();
    expect(screen.queryByText("Шаг A")).toBeNull();
  });

  it("invalidates unresolved save and start work on unmount without state updates", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    let resolveSave!: (value: Task) => void;
    const saveView = render(<NowCard task={task} mode="current" {...props} onSaveFirstStep={() => new Promise<Task>((resolve) => { resolveSave = resolve; })} />);
    fireEvent.press(screen.getByText("Мне трудно начать"));
    fireEvent.changeText(screen.getByLabelText("Первый маленький шаг"), "Черновик");
    fireEvent.press(screen.getByText("Сохранить маленький шаг"));
    saveView.unmount();
    await act(async () => resolveSave({ ...task, firstStep: "Поздний шаг" }));

    let rejectStart!: (error: Error) => void;
    const startView = render(<NowCard task={{ ...task, firstStep: "Шаг" }} mode="current" {...props} onStart={() => new Promise<void>((_resolve, reject) => { rejectStart = reject; })} />);
    fireEvent.press(screen.getByText("Мне трудно начать"));
    fireEvent.press(screen.getByText("Начать с этого шага"));
    startView.unmount();
    await act(async () => rejectStart(new Error("late failure")));

    expect(consoleError.mock.calls.flat().join(" ")).not.toMatch(/unmounted component|not wrapped in act/i);
    consoleError.mockRestore();
  });
});
