const mockUser = { timeFormat: "H24" as "H24" | "H12" };
jest.mock("../stores/auth.store", () => ({
  useAuthStore: (selector: any) => selector({ user: mockUser }),
}));
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import type { Task } from "@focus/shared-types";
import { NowCard } from "./NowCard";

const task: Task = {
  id: "task-1",
  userId: "user-1",
  title: "Подготовить один слайд",
  startTime: new Date("2026-08-12T14:30:00.000Z"),
  durationMinutes: 30,
  color: "#6B5BFC",
  isRecurring: false,
  recurrenceRule: null,
  parentTaskId: null,
  completedAt: null,
  createdAt: new Date("2026-08-12T12:00:00.000Z"),
  updatedAt: new Date("2026-08-12T12:00:00.000Z"),
};

describe("NowCard", () => {
  it("shows honest known and unknown duration text", () => {
    const { rerender } = render(
      <NowCard
        task={task}
        mode="current"
        onComplete={jest.fn()}
        onOpenTask={jest.fn()}
      />,
    );
    expect(screen.getByText(/около 30 мин/)).toBeTruthy();
    rerender(
      <NowCard
        task={{ ...task, durationMinutes: null }}
        mode="current"
        onComplete={jest.fn()}
        onOpenTask={jest.fn()}
      />,
    );
    expect(screen.getByText(/Длительность: Не знаю/)).toBeTruthy();
    expect(screen.queryByText(/около 0 мин/)).toBeNull();
  });
  it("делает завершение текущей задачи главным действием", () => {
    const onComplete = jest.fn();
    const onOpenTask = jest.fn();

    render(
      <NowCard
        task={task}
        mode="current"
        onComplete={onComplete}
        onOpenTask={onOpenTask}
      />,
    );

    expect(screen.getByText("Сейчас")).toBeTruthy();
    expect(screen.getByText("Текущее действие")).toBeTruthy();
    expect(screen.getByText(task.title)).toBeTruthy();

    fireEvent.press(screen.getByText("Завершить"));

    expect(onComplete).toHaveBeenCalledWith(task.id);
    expect(onOpenTask).not.toHaveBeenCalled();
  });

  it("открывает ближайшую задачу без ложного состояния «начата»", () => {
    const onComplete = jest.fn();
    const onOpenTask = jest.fn();

    render(
      <NowCard
        task={task}
        mode="upcoming"
        onComplete={onComplete}
        onOpenTask={onOpenTask}
      />,
    );

    expect(screen.getByText("Ближайшее действие")).toBeTruthy();
    expect(screen.queryByText("Завершить")).toBeNull();

    fireEvent.press(screen.getByText("Открыть задачу"));

    expect(onOpenTask).toHaveBeenCalledWith(task);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("открывает изменение плана как вторичное действие текущей задачи", () => {
    const onOpenTask = jest.fn();

    render(
      <NowCard
        task={task}
        mode="current"
        onComplete={jest.fn()}
        onOpenTask={onOpenTask}
      />,
    );

    fireEvent.press(screen.getByText("Изменить план"));

    expect(onOpenTask).toHaveBeenCalledWith(task);
  });
  it("changes only clock convention without introducing profile-timezone interpretation", () => {
    const instant = new Date(task.startTime!);
    const before = instant.getTime();
    const originalTimezone = process.env.TZ;
    process.env.TZ = "UTC";
    mockUser.timeFormat = "H24";
    const { rerender } = render(
      <NowCard
        task={{ ...task, startTime: instant }}
        mode="upcoming"
        onComplete={jest.fn()}
        onOpenTask={jest.fn()}
      />,
    );
    expect(screen.getByText(/14:30/)).toBeTruthy();
    mockUser.timeFormat = "H12";
    rerender(
      <NowCard
        task={{ ...task, startTime: instant }}
        mode="upcoming"
        onComplete={jest.fn()}
        onOpenTask={jest.fn()}
      />,
    );
    expect(screen.getByText(/2:30.*PM/i)).toBeTruthy();
    expect(instant.getTime()).toBe(before);
    process.env.TZ = originalTimezone;
  });
});
