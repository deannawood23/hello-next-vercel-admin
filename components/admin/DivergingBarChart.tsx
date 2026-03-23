type DataPoint = {
    label: string;
    value: number;
    upvotes: number;
    downvotes: number;
};

type DivergingBarChartProps = {
    title: string;
    data: DataPoint[];
};

export function DivergingBarChart({ title, data }: DivergingBarChartProps) {
    const maxMagnitude = data.reduce((acc, point) => {
        const magnitude = Math.abs(point.value);
        return magnitude > acc ? magnitude : acc;
    }, 0);

    return (
        <section className="rounded-xl border border-white/10 bg-white/[0.04] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <h2 className="text-sm font-semibold text-[#EDEDEF]">{title}</h2>
            <div className="mt-4 grid grid-cols-7 items-stretch gap-2">
                {data.map((point) => {
                    const magnitudeHeight =
                        maxMagnitude > 0
                            ? Math.max(8, Math.round((Math.abs(point.value) / maxMagnitude) * 96))
                            : 8;
                    const isPositive = point.value >= 0;
                    const hoverText = `${point.label}
Upvotes: ${point.upvotes}
Downvotes: ${point.downvotes}
Net: ${point.value}`;

                    return (
                        <div
                            key={point.label}
                            className="flex flex-col items-center gap-2"
                            title={hoverText}
                        >
                            <div className="text-[10px] text-[#8A8F98]">{point.value}</div>
                            <div className="flex h-48 w-full flex-col">
                                <div className="flex h-1/2 items-end justify-center">
                                    {isPositive ? (
                                        <div
                                            className="w-full rounded-t bg-gradient-to-t from-[#5E6AD2] to-[#91A3FF]"
                                            style={{ height: magnitudeHeight }}
                                            aria-label={`${point.label}: ${point.value}`}
                                        />
                                    ) : (
                                        <div className="w-full" />
                                    )}
                                </div>
                                <div className="h-px w-full bg-white/10" />
                                <div className="flex h-1/2 items-start justify-center">
                                    {isPositive ? (
                                        <div className="w-full" />
                                    ) : (
                                        <div
                                            className="w-full rounded-b bg-gradient-to-b from-[#FF8A8A] to-[#D24C4C]"
                                            style={{ height: magnitudeHeight }}
                                            aria-label={`${point.label}: ${point.value}`}
                                        />
                                    )}
                                </div>
                            </div>
                            <div className="text-[10px] text-[#A6ACB6]">{point.label}</div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
