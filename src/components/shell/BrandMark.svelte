<script lang="ts">
interface Props {
  class?: string
}

let { class: className = 'size-7' }: Props = $props()
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 512 512"
  class={className}
  role="img"
  aria-label="Finances"
>
  <rect width="512" height="512" fill="var(--brand)" />
  <rect x="120" y="296" width="64" height="96" fill="var(--primary-foreground)" />
  <rect x="224" y="216" width="64" height="176" fill="var(--primary-foreground)" />
  <rect x="328" y="136" width="64" height="256" fill="var(--primary-foreground)" />
</svg>
