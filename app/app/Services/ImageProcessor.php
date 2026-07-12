<?php

namespace App\Services;

use GdImage;
use Illuminate\Http\UploadedFile;

/**
 * Redimensionne et recompresse les images à l'upload.
 *
 * Une battle map sort souvent d'un export 4000 px et pèse plusieurs Mo alors
 * qu'elle est affichée dans un cadre de ~1200 px. On la ramène donc à 2000 px de
 * plus grand côté et on la réencode en WebP : le quota de stockage porte sur le
 * fichier final, pas sur la source.
 */
class ImageProcessor
{
    /** Plus grand côté conservé. Les images plus petites ne sont jamais agrandies. */
    public const MAX_DIMENSION = 2000;

    public const WEBP_QUALITY = 82;

    /**
     * @return array{contents: string, extension: string, mime: string}|null
     *         null → conserver le fichier d'origine tel quel.
     */
    public function process(UploadedFile $file): ?array
    {
        // Les GIF peuvent être animés : GD ne réencoderait que la première image.
        if ($file->getMimeType() === 'image/gif') {
            return null;
        }

        $source = @imagecreatefromstring((string) file_get_contents($file->getRealPath()));
        if (! $source instanceof GdImage) {
            return null; // illisible par GD : on garde l'original, la validation l'a déjà accepté
        }

        $image = $this->downscale($source);

        ob_start();
        $ok = imagewebp($image, null, self::WEBP_QUALITY);
        $contents = (string) ob_get_clean();
        imagedestroy($image);

        if (! $ok || $contents === '') {
            return null;
        }

        return [
            'contents'  => $contents,
            'extension' => 'webp',
            'mime'      => 'image/webp',
        ];
    }

    private function downscale(GdImage $image): GdImage
    {
        imagepalettetotruecolor($image);
        imagealphablending($image, false);
        imagesavealpha($image, true);

        $width  = imagesx($image);
        $height = imagesy($image);
        $largest = max($width, $height);

        if ($largest <= self::MAX_DIMENSION) {
            return $image;
        }

        $ratio     = self::MAX_DIMENSION / $largest;
        $newWidth  = max(1, (int) round($width * $ratio));
        $newHeight = max(1, (int) round($height * $ratio));

        $resized = imagecreatetruecolor($newWidth, $newHeight);
        imagealphablending($resized, false);
        imagesavealpha($resized, true);
        imagecopyresampled($resized, $image, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);

        imagedestroy($image);

        return $resized;
    }
}
