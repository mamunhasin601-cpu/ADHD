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

describe("NowCard explicit start", () => {
  it.each(["current", "upcoming"] as const)("offers start for an unstarted %s task", (mode) => {
    const onStart = jest.fn();
    render(<NowCard task={task} mode={mode} onStart={onStart} onComplete={jest.fn()} onOpenTask={jest.fn()} />);
    expect(screen.getByText("Начать")).toBeTruthy();
    expect(screen.queryByText("Завершить")).toBeNull();
    fireEvent.press(screen.getByText("Начать"));
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStart).toHaveBeenCalledWith(task.id);
  });

  it("exposes the pending start as busy and disabled", () => {
    render(<NowCard task={task} mode="current" onStart={jest.fn()} onComplete={jest.fn()} onOpenTask={jest.fn()} isStarting />);
    expect(screen.getByText("Начинаю…")).toBeDisabled();
    expect(screen.getByRole("button", { name: `Начать задачу ${task.title}` }).props.accessibilityState).toEqual({ disabled: true, busy: true });
  });

  it("only offers completion after the server start exists", () => {
    const onComplete = jest.fn();
    render(<NowCard task={{ ...task, startedAt: new Date("2026-08-12T14:31:07Z") }} mode="current" onStart={jest.fn()} onComplete={onComplete} onOpenTask={jest.fn()} />);
    expect(screen.getByText("Начато")).toBeTruthy();
    fireEvent.press(screen.getByText("Завершить"));
    expect(onComplete).toHaveBeenCalledWith(task.id);
  });

  it("keeps duration, calm error, and the configured clock convention", () => {
    process.env.TZ = "UTC";
    const { rerender } = render(<NowCard task={task} mode="current" onStart={jest.fn()} onComplete={jest.fn()} onOpenTask={jest.fn()} startError="Попробуйте снова" />);
    expect(screen.getByText(/около 30 мин/)).toBeTruthy();
    expect(screen.getByRole("alert")).toHaveTextContent("Попробуйте снова");
    expect(screen.getByText(/14:30/)).toBeTruthy();
    mockUser.timeFormat = "H12";
    rerender(<NowCard task={task} mode="current" onStart={jest.fn()} onComplete={jest.fn()} onOpenTask={jest.fn()} />);
    expect(screen.getByText(/2:30.*PM/i)).toBeTruthy();
  });
});
