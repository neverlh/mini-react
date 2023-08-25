import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'

function App() {
	const [num, setNum] = useState(100)

	const arr =
		num % 2 === 0
			? [
					<li key="1"></li>,
					<li key="2">2</li>,
					<li key="3">3</li>,
					<>
						<div>7</div>
						<div>8</div>
					</>
			  ]
			: [
					<li key="3">3</li>,
					<li key="2">2</li>,
					<li key="1">1</li>,
					<>
						<div>7</div>
						<div>8</div>
					</>
			  ]

	return (
		<>
			<ul onClickCapture={() => setNum(num + 1)}>
				<li>4</li>
				<li>5</li>
				{arr}
			</ul>
			{num % 2 === 0 ? <>9</> : <>10</>}
		</>
	)
}

// function Child() {
// 	return <span>mini-react</span>
// }

ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
