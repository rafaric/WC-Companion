"use client";

import Image from "next/image";

import { cn } from "@/lib/cn";

interface TeamCrestProps {
	crestUrl: string | null;
	shortName: string;
	className?: string;
}

export function TeamCrest({ crestUrl, shortName, className }: TeamCrestProps) {
	if (!crestUrl) {
		return null;
	}

	return (
		<Image
			src={crestUrl}
			alt={`${shortName} crest`}
			width={20}
			height={20}
			className={cn("inline-block h-5 w-5 object-contain", className)}
			unoptimized
		/>
	);
}
