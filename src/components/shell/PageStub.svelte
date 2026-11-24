<script lang="ts">
let { title }: { title: string } = $props()
</script>

<div class="flex h-64 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
  <p class="text-base font-heading font-medium text-foreground">{title}</p>
  <p>This page is being ported to Svelte.</p>
</div>
