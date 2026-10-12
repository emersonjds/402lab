import Svg, { Circle, ClipPath, Defs, G, Path } from 'react-native-svg';

const FLASK = 'M27 13V27L15.5 47.5A4 4 0 0 0 19 53.5H45A4 4 0 0 0 48.5 47.5L37 27V13';

interface LogoMarkProps {
  size: number;
}

export const LogoMark = ({ size }: LogoMarkProps) => (
  <Svg width={size} height={size} viewBox="12 9 40 47" accessibilityLabel="402Lab logo">
    <Defs>
      <ClipPath id="flask-inside">
        <Path d={`${FLASK}Z`} />
      </ClipPath>
    </Defs>
    <G clipPath="url(#flask-inside)">
      <Path d="M0 39Q8 36 16 39T32 39T48 39T64 39V64H0Z" fill="#B6F23A" />
      <Circle cx={28} cy={47} r={2.4} fill="#0B0D10" />
      <Circle cx={36} cy={43.5} r={1.5} fill="#0B0D10" />
    </G>
    <Circle cx={34} cy={31} r={2.2} fill="#B6F23A" />
    <Path
      d={FLASK}
      fill="none"
      stroke="#E8EAED"
      strokeWidth={3.5}
      strokeLinejoin="round"
      strokeLinecap="round"
    />
    <Path d="M23 12.5H41" stroke="#E8EAED" strokeWidth={3.5} strokeLinecap="round" />
  </Svg>
);
