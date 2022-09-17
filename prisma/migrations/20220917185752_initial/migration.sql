-- CreateTable
CREATE TABLE `Guild` (
    `guildId` VARCHAR(191) NOT NULL,
    `channelId` VARCHAR(191) NOT NULL,
    `canUpload` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`guildId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User` (
    `userId` VARCHAR(191) NOT NULL,
    `canForceSkip` BOOLEAN NOT NULL DEFAULT false,
    `bannedUntil` DATETIME(3) NULL,

    PRIMARY KEY (`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Song` (
    `songId` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `artist` VARCHAR(191) NOT NULL,
    `artworkUrl` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NOT NULL,
    `added` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`songId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SongRating` (
    `songId` INTEGER NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `rating` ENUM('LIKE', 'NEUTRAL', 'DISLIKE') NOT NULL,

    PRIMARY KEY (`songId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Song` ADD CONSTRAINT `Song_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`userId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SongRating` ADD CONSTRAINT `SongRating_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`userId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SongRating` ADD CONSTRAINT `SongRating_songId_fkey` FOREIGN KEY (`songId`) REFERENCES `Song`(`songId`) ON DELETE RESTRICT ON UPDATE CASCADE;
