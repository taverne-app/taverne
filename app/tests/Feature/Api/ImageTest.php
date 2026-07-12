<?php

namespace Tests\Feature\Api;

use App\Models\Image;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ImageTest extends TestCase
{
    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
        $this->user = User::factory()->create(['plan' => 'free']);
    }

    private function upload(?UploadedFile $file = null)
    {
        return $this->actingAs($this->user)->postJson('/api/images', [
            'file' => $file ?? UploadedFile::fake()->image('donjon.png', 400, 250),
        ]);
    }

    /** Remplit la bibliothèque sans passer par HTTP (taille en octets). */
    private function fill(int $count, ?User $owner = null, int $size = 100): void
    {
        $owner ??= $this->user;
        for ($i = 0; $i < $count; $i++) {
            $owner->images()->create([
                'disk' => 'public', 'path' => "images/{$owner->id}/f{$i}.png",
                'original_name' => "f{$i}.png", 'mime' => 'image/png', 'size' => $size,
            ]);
        }
    }

    // ── Upload ───────────────────────────────────────────────────────────────

    public function test_upload_stores_the_file_and_returns_its_url(): void
    {
        $response = $this->upload()->assertCreated();

        $image = Image::sole();
        $this->assertSame($this->user->id, $image->user_id);
        $this->assertSame('donjon.png', $image->original_name);
        Storage::disk('public')->assertExists($image->path);

        $response->assertJsonPath('data.original_name', 'donjon.png')
            ->assertJsonPath('meta.used', 1)
            ->assertJsonPath('meta.max', 10);
    }

    public function test_upload_rejects_a_non_image(): void
    {
        $this->upload(UploadedFile::fake()->create('notes.pdf', 20, 'application/pdf'))
            ->assertStatus(422);

        $this->assertSame(0, Image::count());
    }

    public function test_upload_rejects_a_file_over_5_mb(): void
    {
        // 6 Mo > limite de 5120 Ko
        $this->upload(UploadedFile::fake()->image('enorme.png')->size(6144))
            ->assertStatus(422);

        $this->assertSame(0, Image::count());
    }

    // ── Quota par plan ───────────────────────────────────────────────────────

    public function test_free_plan_is_capped_at_ten_images(): void
    {
        $this->fill(10);

        $this->upload()->assertForbidden();

        $this->assertSame(10, $this->user->images()->count());
    }

    public function test_paid_plan_is_not_capped(): void
    {
        $this->user->update(['plan' => 'guild']);
        $this->fill(10);

        $this->upload()->assertCreated()
            ->assertJsonPath('meta.max', null)
            ->assertJsonPath('meta.max_bytes', null);

        $this->assertSame(11, $this->user->images()->count());
    }

    // ── Plafond d'octets cumulés (indépendant du nombre d'images) ────────────

    public function test_free_plan_is_capped_by_total_stored_bytes(): void
    {
        // 3 images de 8 Mo = 24 Mo : bien en deçà des 10 images, mais proche des 25 Mo.
        $this->fill(3, size: 8 * 1024 * 1024);

        // Une image de 2 Mo ferait 26 Mo > 25 Mo → refusée sur le poids, pas le nombre.
        $this->upload(UploadedFile::fake()->image('lourde.png')->size(2048))
            ->assertForbidden();

        $this->assertSame(3, $this->user->images()->count());
    }

    public function test_upload_fits_when_it_stays_under_the_byte_cap(): void
    {
        $this->fill(3, size: 8 * 1024 * 1024); // 24 Mo

        // 500 Ko → 24,5 Mo, sous les 25 Mo : accepté.
        $this->upload(UploadedFile::fake()->image('legere.png')->size(500))
            ->assertCreated();

        $this->assertSame(4, $this->user->images()->count());
    }

    public function test_quota_reports_bytes_used_and_max(): void
    {
        $this->fill(2, size: 1024 * 1024); // 2 Mo

        $this->actingAs($this->user)
            ->getJson('/api/images')
            ->assertOk()
            ->assertJsonPath('meta.used_bytes', 2 * 1024 * 1024)
            ->assertJsonPath('meta.max_bytes', 25 * 1024 * 1024);
    }

    public function test_deleting_an_image_frees_a_slot_and_removes_the_file(): void
    {
        $this->upload()->assertCreated();
        $image = Image::sole();

        $this->actingAs($this->user)
            ->deleteJson("/api/images/{$image->id}")
            ->assertOk()
            ->assertJsonPath('meta.used', 0);

        $this->assertSame(0, Image::count());
        Storage::disk('public')->assertMissing($image->path);
    }

    // ── Cloisonnement ────────────────────────────────────────────────────────

    public function test_index_lists_only_own_images(): void
    {
        $this->fill(2);
        $this->fill(3, User::factory()->create());

        $this->actingAs($this->user)
            ->getJson('/api/images')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('meta.used', 2);
    }

    public function test_cannot_delete_someone_elses_image(): void
    {
        $stranger = User::factory()->create();
        $this->fill(1, $stranger);
        $image = Image::sole();

        $this->actingAs($this->user)
            ->deleteJson("/api/images/{$image->id}")
            ->assertForbidden();

        $this->assertSame(1, Image::count());
    }

    public function test_upload_requires_authentication(): void
    {
        $this->postJson('/api/images', ['file' => UploadedFile::fake()->image('x.png')])
            ->assertUnauthorized();
    }
}
