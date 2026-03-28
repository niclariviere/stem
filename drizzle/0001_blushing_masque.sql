CREATE TABLE `bandlabProjects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`projectUrl` text NOT NULL,
	`projectName` varchar(200),
	`parsedData` json,
	`importedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bandlabProjects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `collectionStems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`collectionId` int NOT NULL,
	`stemId` int NOT NULL,
	`order` int DEFAULT 0,
	CONSTRAINT `collectionStems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `invitations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`token` varchar(64) NOT NULL,
	`createdBy` int NOT NULL,
	`usedBy` int,
	`usedAt` timestamp,
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `invitations_id` PRIMARY KEY(`id`),
	CONSTRAINT `invitations_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `matchNotifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`toUserId` int NOT NULL,
	`fromUserId` int NOT NULL,
	`stemId1` int NOT NULL,
	`stemId2` int NOT NULL,
	`score` float NOT NULL,
	`isRead` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `matchNotifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `matchingScores` (
	`id` int AUTO_INCREMENT NOT NULL,
	`stemId1` int NOT NULL,
	`stemId2` int NOT NULL,
	`totalScore` float NOT NULL,
	`bpmScore` float,
	`keyScore` float,
	`timbreScore` float,
	`genreScore` float,
	`cachedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `matchingScores_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ownershipLicensing` (
	`id` int AUTO_INCREMENT NOT NULL,
	`stemId` int NOT NULL,
	`creatorId` int NOT NULL,
	`licenseType` enum('cc0','cc-by','cc-by-nc','proprietary') NOT NULL DEFAULT 'cc-by',
	`royaltyPercentage` float DEFAULT 0,
	`usageRights` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ownershipLicensing_id` PRIMARY KEY(`id`),
	CONSTRAINT `ownershipLicensing_stemId_unique` UNIQUE(`stemId`)
);
--> statement-breakpoint
CREATE TABLE `stemCollections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`isPublic` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stemCollections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stemFlags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`stemId` int NOT NULL,
	`reportedBy` int NOT NULL,
	`reason` enum('copyright','inappropriate','spam','other') NOT NULL,
	`details` text,
	`status` enum('pending','reviewed','dismissed') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stemFlags_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stemMetadata` (
	`id` int AUTO_INCREMENT NOT NULL,
	`stemId` int NOT NULL,
	`bpm` float,
	`key` varchar(20),
	`instrumentType` varchar(100),
	`genreTags` json,
	`energyLevel` float,
	`mfccVector` json,
	`waveformData` json,
	`analyzedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stemMetadata_id` PRIMARY KEY(`id`),
	CONSTRAINT `stemMetadata_stemId_unique` UNIQUE(`stemId`)
);
--> statement-breakpoint
CREATE TABLE `stems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`ipfsCid` varchar(128),
	`ipfsUrl` text,
	`stemUri` varchar(200),
	`s3Key` varchar(512),
	`s3Url` text,
	`duration` float,
	`fileSize` int,
	`mimeType` varchar(50),
	`nftTokenId` varchar(100),
	`nftTxHash` varchar(100),
	`nftContractAddress` varchar(42),
	`nftChain` varchar(50) DEFAULT 'base-sepolia',
	`isMinted` boolean NOT NULL DEFAULT false,
	`isFlagged` boolean NOT NULL DEFAULT false,
	`flagReason` text,
	`flaggedBy` int,
	`flaggedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `artistName` varchar(100);--> statement-breakpoint
ALTER TABLE `users` ADD `bio` text;--> statement-breakpoint
ALTER TABLE `users` ADD `bandlabUrl` varchar(500);--> statement-breakpoint
ALTER TABLE `users` ADD `spotifyUrl` varchar(500);--> statement-breakpoint
ALTER TABLE `users` ADD `websiteUrl` varchar(500);--> statement-breakpoint
ALTER TABLE `users` ADD `walletAddress` varchar(42);--> statement-breakpoint
ALTER TABLE `users` ADD `isVerified` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `invitedBy` int;