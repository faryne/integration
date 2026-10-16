package agent

import "testing"

func TestProviderRegistryDeclaresCapabilities(t *testing.T) {
	seen := map[string]bool{}
	for _, provider := range catalog {
		descriptor := provider.descriptor
		if descriptor.ID == "" || descriptor.DisplayName == "" || seen[descriptor.ID] {
			t.Fatalf("invalid provider descriptor: %#v", descriptor)
		}
		seen[descriptor.ID] = true
		if len(descriptor.Capabilities) != 1 || descriptor.Capabilities[0] != CapabilityConversation {
			t.Fatalf("CLI provider must declare conversation capability: %#v", descriptor)
		}
	}
}
