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

    /** Remplit la bibliothèque jusqu'au quota sans passer par HTTP. */
    private function fill(int $count, ?User $owner = null): void
    {
        $owner ??= $this->user;
        for ($i = 0; $i < $count; $i++) {
            $owner->images()->create([
                'disk' => 'public', 'path' => "images/{$owner->id}/f{$i}.png",
                'original_name' => "f{$i}.png", 'mime' => 'image/png', 'size' => 100,
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

        $this->upload()->assertCreated()->assertJsonPath('meta.max', null);

        $this->assertSame(11, $this->user->images()->count());
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
