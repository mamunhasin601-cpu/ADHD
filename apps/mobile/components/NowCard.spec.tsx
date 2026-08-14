const mockUser = { timeFormat: "H24" as "H24" | "H12" };
jest.mock("../stores/auth.store", () => ({
  useAuthStore: (selector: any) => selector({ user: mockUser }),
}));
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import type { Task } from "@focus/shared-types";
import { NowCard } from "./NowCard";

const task: Task = {
  id: "task-1", userId: "user-1", title: "Подготовить один слайд",
  startTime: new Date("2026-08-12T14:30:00.000Z"), durationMinutes: 30,
  color: "#6B5BFC", isRecurring: false, recurrenceRule: null, parentTaskId: null,
  completedAt: null, startedAt: null, createdAt: new Date(), updatedAt: new Date(),
};
const props = { onStart: jest.fn(), onComplete: jest.fn(), onOpenTask: jest.fn() };

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
