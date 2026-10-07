"""Model builders."""
from __future__ import annotations

import segmentation_models_pytorch as smp
import timm
import torch
import torch.nn as nn


def build_seg_model(arch: str = "segformer", encoder: str = "mit_b2", num_classes: int = 1,
                    pretrained: bool = True) -> nn.Module:
    """Segmentation network.

    segformer + mit_b2  : strong default, fits a free T4/P100 at 512px with AMP.
    unetplusplus + efficientnet-b4 / unet + resnet34 : classic baselines to compare against.
    """
    weights = "imagenet" if pretrained else None
    archs = {
        "segformer": smp.Segformer,
        "unet": smp.Unet,
        "unetplusplus": smp.UnetPlusPlus,
        "deeplabv3plus": smp.DeepLabV3Plus,
    }
    if arch not in archs:
        raise ValueError(f"arch must be one of {list(archs)}")
    return archs[arch](encoder_name=encoder, encoder_weights=weights, classes=num_classes)


class WoundClassifier(nn.Module):
    """Image backbone + optional metadata branch (body location, intake answers).

    Body location alone separates many wound types (heel/sacrum -> pressure,
    plantar forefoot -> diabetic, gaiter area -> venous), so fusing it helps.
    """

    def __init__(self, backbone: str, num_classes: int, meta_dim: int = 0, pretrained: bool = True,
                 dropout: float = 0.3):
        super().__init__()
        self.backbone = timm.create_model(backbone, pretrained=pretrained, num_classes=0)
        feat = self.backbone.num_features
        self.meta = nn.Sequential(nn.Linear(meta_dim, 32), nn.ReLU()) if meta_dim > 0 else None
        self.head = nn.Sequential(nn.Dropout(dropout), nn.Linear(feat + (32 if meta_dim > 0 else 0), num_classes))

    def forward(self, x: torch.Tensor, meta: torch.Tensor | None = None) -> torch.Tensor:
        f = self.backbone(x)
        if self.meta is not None:
            f = torch.cat([f, self.meta(meta)], dim=1)
        return self.head(f)


def load_matching(model: nn.Module, path: str) -> int:
    """Initialise from an earlier checkpoint, copying every weight whose name and shape match.

    Used for 'train on public data, then fine-tune on your clinic's data', and to start the
    tissue model from the boundary model's encoder (the output layer differs and is skipped).
    """
    ck = torch.load(path, map_location="cpu", weights_only=False)
    src = ck.get("state_dict", ck)
    own = model.state_dict()
    keep = {k: v for k, v in src.items() if k in own and own[k].shape == v.shape}
    model.load_state_dict(keep, strict=False)
    print(f"initialised {len(keep)}/{len(own)} tensors from {path}")
    return len(keep)


class TemperatureScaler(nn.Module):
    """Post-hoc calibration: one scalar T fitted on the validation set.

    Makes '80% confident' actually mean right ~80% of the time, which is what the
    abstain/'uncertain' logic in the report relies on.
    """

    def __init__(self):
        super().__init__()
        self.log_t = nn.Parameter(torch.zeros(1))

    @property
    def temperature(self) -> float:
        return float(self.log_t.exp())

    def fit(self, logits: torch.Tensor, labels: torch.Tensor, steps: int = 300) -> float:
        opt = torch.optim.LBFGS([self.log_t], lr=0.05, max_iter=steps)
        nll = nn.CrossEntropyLoss()

        def closure():
            opt.zero_grad()
            loss = nll(logits / self.log_t.exp(), labels)
            loss.backward()
            return loss

        opt.step(closure)
        return self.temperature
