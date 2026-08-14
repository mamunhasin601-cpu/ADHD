import { UsersService } from "./users.service";

describe("UsersService profile time format persistence", () => {
  const base = {
    id: "u1",
    email: "u@test.dev",
    phone: null,
    passwordHash: "secret",
    timezone: "Europe/Moscow",
    timeFormat: "SYSTEM",
    hasCompletedOnboarding: true,
    plan: "FREE",
    proExpiresAt: null,
    expoPushToken: null,
    yandexId: null,
    vkId: null,
    mailruId: null,
    createdAt: new Date(),
  };
  const update = jest.fn();
  const service = new UsersService({ user: { update } } as any);
  beforeEach(() => {
    update.mockReset();
    update.mockImplementation(({ data }) =>
      Promise.resolve({ ...base, ...data }),
    );
  });

  it.each(["SYSTEM", "H24", "H12"] as const)(
    "passes %s unchanged to Prisma and returns it",
    async (timeFormat) => {
      const result = await service.update("u1", { timeFormat } as any);
      expect(update).toHaveBeenCalledWith({
        where: { id: "u1" },
        data: { timeFormat },
      });
      expect(result.timeFormat).toBe(timeFormat);
      expect(result).not.toHaveProperty("passwordHash");
    },
  );
  it("does not synthesize omitted timeFormat in a timezone-only update", async () => {
    await service.update("u1", { timezone: "Asia/Tokyo" });
    expect(update.mock.calls[0][0].data).toEqual({ timezone: "Asia/Tokyo" });
  });
  it("does not overwrite timezone in a timeFormat-only update", async () => {
    await service.update("u1", { timeFormat: "H12" } as any);
    expect(update.mock.calls[0][0].data).not.toHaveProperty("timezone");
  });
  it("safe response includes timeFormat and excludes passwordHash", async () => {
    const result = await service.update("u1", { timezone: "UTC" });
    expect(result.timeFormat).toBe("SYSTEM");
    expect(result).not.toHaveProperty("passwordHash");
  });
});
