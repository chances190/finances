<script lang="ts">
import { Button } from '@/components/ui/button'
import ExportImport from './ExportImport.svelte'

let showImport = $state(false)
</script>

<div class="space-y-3">
  <div>
    <p class="mb-1 text-xs text-muted-foreground">Export</p>
    <ExportImport />
  </div>
  <div>
    <p class="mb-1 text-xs text-muted-foreground">Import</p>
    <Button
      variant="outline"
      size="xs"
      onclick={() => {
        showImport = true
      }}
    >
      Import Backup (.json)
    </Button>
  </div>
  {#if showImport}
    {#await import('./ImportDialog.svelte') then module}
      {@const ImportDialog = module.default}
      <ImportDialog
        open
        onOpenChange={(value) => {
          showImport = value
        }}
        mode="backup"
      />
    {/await}
  {/if}
</div>
